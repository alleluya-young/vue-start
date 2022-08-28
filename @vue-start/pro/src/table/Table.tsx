import { computed, defineComponent, ExtractPropTypes, inject, PropType, provide, ref, VNode } from "vue";
import { TColumn, TElementMap } from "../types";
import { filter, get, isFunction, keys, map, omit, some, sortBy } from "lodash";
import { getItemEl } from "../core";
import { Ref } from "@vue/reactivity";
import { mergeStateToList } from "../util";

const ProTableKey = Symbol("pro-table");

export interface IProTableProvideExtra extends Record<string, any> {}

export interface IProTableProvide extends IProTableProvideExtra {
  columns: Ref<TTableColumns>;
}

export const useProTable = () => inject(ProTableKey) as IProTableProvide;

const provideProTable = (ctx: IProTableProvide) => {
  provide(ProTableKey, ctx);
};

export type TTableColumn = {
  //antd 自定义列
  customRender?: (opt: {
    value: any;
    text: any;
    record: Record<string, any>;
    index: number;
    column: TTableColumn;
  }) => VNode | string | number;

  fixed?: boolean | string;
  width?: number | string;
} & TColumn;

export type TTableColumns = TTableColumn[];

/**
 * 单个操作描述
 */
export interface IOperateItem {
  value: string | number;
  label?: string | VNode;
  element?: (record: Record<string, any>, item: IOperateItem) => VNode;
  show?: boolean | ((record: Record<string, any>) => boolean);
  disabled?: boolean | ((record: Record<string, any>) => boolean);
  onClick?: (record: Record<string, any>) => void;
  sort?: number;
}

/**
 * 整个操作栏描述
 */
export interface ITableOperate {
  column?: TColumn; //table 的column属性
  items?: IOperateItem[];
  //对item的补充 key为item的value
  itemState?: { [key: string]: Omit<IOperateItem, "value"> };
}

const proTableProps = () => ({
  //操作栏
  operate: {
    type: Object as PropType<ITableOperate>,
  },
  //默认空字符串
  columnEmptyText: { type: String },
  /**
   * 公共column，会merge到columns item中
   */
  column: { type: Object as PropType<TTableColumn> },
  //
  columns: { type: Array as PropType<TTableColumns> },
  columnState: { type: Object as PropType<Record<string, any>> },
  /**
   * 展示控件集合，readonly模式下使用这些组件渲染
   */
  elementMap: { type: Object as PropType<TElementMap> },
  /**
   * 序号
   */
  serialNumber: { type: Boolean },
  /**
   * 分页
   */
  paginationState: { type: Object as PropType<{ page?: number; pageSize?: number }> },
  /**
   * provide传递
   */
  provideExtra: { type: Object as PropType<IProTableProvideExtra> },
});

export type ProTableProps = Partial<ExtractPropTypes<ReturnType<typeof proTableProps>>>;

export const createTable = (Table: any, Props?: any): any => {
  return defineComponent<ProTableProps>({
    props: {
      ...Table.props,
      ...Props,
      ...proTableProps(),
    },
    setup: (props, { slots }) => {
      const createNumberColumn = (): TTableColumn => ({
        title: "序号",
        dataIndex: "serialNumber",
        width: 80,
        ...props.column,
        customRender: ({ index }) => {
          if (props.paginationState?.page && props.paginationState?.pageSize) {
            return props.paginationState.pageSize * (props.paginationState.page - 1) + index + 1;
          }
          return index + 1;
        },
      });

      const createOperateColumn = (): TTableColumn => {
        const operate = props.operate!;
        //将itemState补充的信息拼到item中
        const items = map(operate.items, (i) => ({ ...i, ...get(operate.itemState, i.value) }));
        //排序
        const sortedItems = sortBy(items, (item) => item.sort);
        return {
          ...props.column,
          title: "操作",
          dataIndex: "operate",
          fixed: "right",
          customRender: ({ record }) => {
            const showItems = filter(sortedItems, (item) => {
              if (item.show && isFunction(item.show)) {
                return item.show(record);
              }
              if (item.show === false) {
                return false;
              }
              return true;
            });

            return (
              <div class={"pro-table-operate"}>
                {map(showItems, (item) => {
                  //自定义
                  if (isFunction(item.element)) {
                    return item.element(record, item);
                  }
                  return (
                    <div
                      class={"pro-table-operate-item"}
                      key={item.value}
                      onClick={() => {
                        item.onClick?.(record);
                      }}>
                      {item.label}
                    </div>
                  );
                })}
              </div>
            );
          },
        };
      };

      const columns = computed(() => {
        const mergeColumns = mergeStateToList(props.columns!, props.columnState!, (item) => item.dataIndex);
        //根据valueType选择对应的展示组件
        const columns = map(mergeColumns, (item) => {
          //merge公共item
          const nextItem = { ...props.column, ...item };
          if (!item.customRender) {
            nextItem.customRender = ({ text }) => {
              const vn = getItemEl(
                props.elementMap,
                {
                  ...item,
                  showProps: { ...item.showProps, content: props.columnEmptyText },
                },
                text,
              );
              //如果找不到注册的组件，使用当前值 及 columnEmptyText
              return vn || text || props.columnEmptyText;
            };
          }
          return nextItem;
        });
        //处理序号
        if (props.serialNumber) {
          columns.unshift(createNumberColumn());
        }

        //处理operate
        if (props.operate && props.operate.items && some(props.operate.items, (item) => item.show)) {
          columns.push(createOperateColumn());
        }

        return columns;
      });

      const tableRef = ref();

      provideProTable({ columns, tableRef, ...props.provideExtra });

      const invalidKeys = keys(proTableProps());

      return () => {
        return <Table ref={tableRef} {...omit(props, invalidKeys)} columns={columns.value} v-slots={slots} />;
      };
    },
  });
};
