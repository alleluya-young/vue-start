import { computed, defineComponent, ExtractPropTypes, PropType, VNode } from "vue";
import { Button, Table, TableProps } from "ant-design-vue";
import { map, omit, merge, size, sortBy, filter, isFunction } from "lodash";
import { TColumns } from "../../types";
import { ColumnType } from "ant-design-vue/lib/table/interface";
import { getItemEl } from "../core";

export interface IOperateItem {
  value: string | number;
  label?: string | VNode;
  element?: (record: Record<string, any>) => VNode;
  show?: boolean | ((record: Record<string, any>) => boolean);
  disabled?: boolean | ((record: Record<string, any>) => boolean);
  onClick?: (record: Record<string, any>) => void;
  sort?: number;
}

export interface ITableOperate {
  column?: ColumnType;
  items?: IOperateItem[];
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
  column: { type: Object as PropType<ColumnType> },
  //
  columns: { type: Array as PropType<TColumns> },
  /**
   * 展示控件集合，readonly模式下使用这些组件渲染
   */
  elementMap: { type: Object as PropType<{ [key: string]: any }> },
});

export type ProTableProps = Partial<ExtractPropTypes<ReturnType<typeof proTableProps>>> & Omit<TableProps, "columns">;

export const ProTable = defineComponent<ProTableProps>({
  props: {
    ...Table.props,
    ...proTableProps(),
  },
  setup: (props, { slots }) => {
    const columns = computed(() => {
      //根据valueType选择对应的展示组件
      const columns = map(props.columns, (item) => {
        const nextItem = merge(props.column, item);
        if (!item.customRender) {
          nextItem.customRender = ({ text }) => {
            return getItemEl(
              props.elementMap,
              {
                ...item,
                showProps: { ...item.showProps, content: props.columnEmptyText },
              },
              text,
            );
          };
        }
        return nextItem;
      });

      const operate = props.operate;
      //处理operate
      if (operate && size(operate.items) > 0) {
        //排序
        const operateList = sortBy(operate.items, (item) => item.sort);

        columns.push({
          ...props.column,
          valueType: "option",
          fixed: "right",
          customRender: ({ record }) => {
            const validList = filter(operateList, (item) => {
              if (item.show && isFunction(item.show)) {
                return item.show(record);
              }
              return true;
            });

            return (
              <div class={"pro-table-operate"}>
                {map(validList, (item) => {
                  // 自定义
                  if (isFunction(item.element)) {
                    return item.element(record);
                  }

                  let disabled: undefined | boolean = item.disabled as any;
                  if (isFunction(item.disabled)) {
                    disabled = item.disabled(record);
                  }
                  return (
                    <Button
                      key={item.value}
                      type={"link"}
                      disabled={disabled}
                      onClick={() => {
                        item.onClick?.(record);
                      }}>
                      {item.label}
                    </Button>
                  );
                })}
              </div>
            );
          },
          ...operate.column,
        });
      }

      return columns as any;
    });

    return () => {
      return <Table {...omit(props, "columns")} columns={columns.value} v-slots={slots} />;
    };
  },
});