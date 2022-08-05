/**
 * list:              search + table
 * detail add edit:   form or desc
 */
import { computed, defineComponent, ExtractPropTypes, PropType, reactive, VNode } from "vue";
import { filter, get, keys, omit, pick, sortBy } from "lodash";
import { UnwrapNestedRefs } from "@vue/reactivity";
import { ProModule, ProModuleProps, useProModule } from "../core";
import { TColumns } from "../../types";
import { provideProCurdModule } from "./ctx";
import { ITableOperate } from "../table";
import { ProCurdListProps } from "./CurdList";

export interface ICurdState extends Record<string, any> {
  //list
  listLoading?: boolean; //列表加载状态
  listData?: {
    total: number;
    dataSource: Record<string, any>[];
    [key: string]: any;
  };
  //detail add edit
  detailLoading?: boolean; //详情加载状态
  detailData?: Record<string, any>; //详情数据
  //add
  addContinue?: boolean; //是否显示继续添加
  //add edit
  operateLoading?: boolean; //修改、保存 等等
}

type BooleanOrFun = boolean | ((record: Record<string, any>) => boolean);

/**
 * `on${Action}Bobble`: 冒泡
 */
export interface IOperate {
  //list
  onList?: (values: Record<string, any>) => void; //触发列表刷新
  //detail
  detail?: BooleanOrFun;
  detailLabel?: string | VNode;
  onDetail?: (record: Record<string, any>) => void; //触发详情
  //edit
  edit?: BooleanOrFun;
  editLabel?: string | VNode;
  onEdit?: (record: Record<string, any>) => void; //触发编辑
  onEditExecute?: () => void; //编辑完成触发
  //add
  add?: BooleanOrFun;
  addLabel?: string | VNode;
  onAdd?: () => void; //触发添加
  onAddExecute?: () => void; //添加完成触发
  //delete
  delete?: BooleanOrFun;
  deleteLabel?: string | VNode;
  onDelete?: (record: Record<string, any>) => void; //触发删除

  tableOperate?: ITableOperate;
}

const proCurdModuleProps = () => ({
  /**
   * 状态
   */
  curdState: { type: Object as PropType<UnwrapNestedRefs<ICurdState>> },
  /**
   * 操作配置
   */
  operate: { type: Object as PropType<IOperate> },
  /**
   * 列表Props
   */
  listProps: { type: Object as PropType<ProCurdListProps> },
});

type CurdModuleProps = Partial<ExtractPropTypes<ReturnType<typeof proCurdModuleProps>>>;

const CurdModule = defineComponent<CurdModuleProps>({
  props: {
    ...(proCurdModuleProps() as any),
  },
  setup: (props, { slots }) => {
    const { columns } = useProModule();

    const curdState = props.curdState || reactive({ detailData: {} });

    /**
     * 排序
     * @param list
     * @param propName
     */
    const dealSort = (list: TColumns, propName: string): TColumns => {
      return sortBy(list, (item) => get(item, propName));
    };

    /**
     * 非 hideInForm columns
     */
    const formColumns = computed(() => {
      return dealSort(
        filter(columns.value, (item) => !item.hideInForm),
        "formSort",
      );
    });

    /**
     *  非 hideInTable columns
     */
    const tableColumns = computed(() => {
      return dealSort(
        filter(columns.value, (item) => !item.hideInTable),
        "tableSort",
      );
    });

    /**
     * search columns
     */
    const searchColumns = computed(() => {
      return dealSort(
        filter(columns.value, (item) => !!item.search),
        "searchSort",
      );
    });

    const operate = {
      detailLabel: "详情",
      editLabel: "编辑",
      addLabel: "添加",
      deleteLabel: "删除",
      ...props.operate,
    };

    provideProCurdModule({
      curdState,
      formColumns,
      tableColumns,
      searchColumns,
      operate,
      //
      listProps: props.listProps,
    });

    return () => {
      return slots.default?.();
    };
  },
});

export type ProCurdModuleProps = CurdModuleProps & ProModuleProps;

export const ProCurdModule = defineComponent<ProCurdModuleProps>({
  props: {
    ...ProModule.props,
    ...proCurdModuleProps(),
  },
  setup: (props, slots) => {
    const moduleKeys = keys(ProModule.props);
    return () => {
      return (
        <ProModule {...pick(props, moduleKeys)}>
          <CurdModule {...omit(props, moduleKeys)} v-slots={slots} />
        </ProModule>
      );
    };
  },
});