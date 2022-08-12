import { computed, defineComponent, ExtractPropTypes, h, PropType, reactive } from "vue";
import {
  IProModuleProvide,
  IRequestOpts,
  ProModule,
  ProModuleProps,
  RequestAction,
  useModuleEvent,
  useProModule,
} from "../core";
import { filter, get, keys, map, omit, pick, reduce, sortBy } from "lodash";
import { TColumns } from "../types";
import { UnwrapNestedRefs } from "@vue/reactivity";
import { CurdAction, ICurdAction, ICurdAddAction, ICurdCurrentMode, provideProCurd } from "./ctx";
import { IOperateItem } from "../../../element-pro";

export interface IListData extends Record<string, any> {
  total: number;
  dataSource: Record<string, any>[];
}

export interface ICurdState extends Record<string, any> {
  //list
  listLoading?: boolean; //列表加载状态
  listData?: IListData;
  //mode
  mode?: ICurdCurrentMode;
  //detail add edit
  detailLoading?: boolean; //详情加载状态
  detailData?: Record<string, any>; //详情数据
  //add edit
  operateLoading?: boolean; //修改、保存 等等
  addAction?: ICurdAddAction;
}

/**
 * action：list,detail,add,edit,delete
 */
export interface ICurdOperateOpts extends Omit<IRequestOpts, "action">, Omit<IOperateItem, "value"> {
  action: ICurdAction; //类型，由当前程序赋值
}

export type TCurdActionEvent = {
  //action类型
  action: ICurdAction;
  //add、edit 存在execute类型事件
  type: "emit" | "execute";
  record?: Record<string, any>;
  values?: Record<string, any>;
};

const proCurdProps = () => ({
  /**
   * 列表 或 详情 的唯一标识
   */
  rowKey: { type: String, default: "id" },
  /**
   * operates
   */
  operates: { type: Array as PropType<ICurdOperateOpts[]> },
  /************************* 子组件props *******************************/
  listProps: { type: Object as PropType<Record<string, any>> },
  formProps: { type: Object as PropType<Record<string, any>> },
  descProps: { type: Object as PropType<Record<string, any>> },
  modalProps: { type: Object as PropType<Record<string, any>> },
});

type CurdProps = Partial<ExtractPropTypes<ReturnType<typeof proCurdProps>>>;

const Curd = defineComponent<CurdProps>({
  props: {
    ...(proCurdProps() as any),
  },
  setup: (props, { slots }) => {
    const { columns, state, sendEvent, sendRequest } = useProModule() as Omit<IProModuleProvide, "state"> & {
      state: ICurdState;
    };

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
     * 非 hideInDetail columns
     */
    const descColumns = computed(() => {
      return dealSort(
        filter(columns.value, (item) => !item.hideInDetail),
        "descSort",
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

    /******************************** 逻辑 *************************************/

    //上一次发起列表请求的参数
    let prevListParams: Record<string, any> | undefined;
    //刷新列表
    const handleSearch = (extra?: Record<string, any>) => {
      sendRequest(CurdAction.LIST, { ...prevListParams, ...extra });
    };

    //发送事件
    const sendCurdEvent = (event: TCurdActionEvent) => {
      sendEvent({ type: event.action, payload: omit(event, "action") });
    };

    //事件订阅
    useModuleEvent((event) => {
      if (event.type === RequestAction.Success) {
        return;
      } else if (event.type === RequestAction.Fail) {
        return;
      }

      const action = event.type as ICurdAction;

      const { type, values, record } = event.payload as Omit<TCurdActionEvent, "action">;

      switch (action) {
        case CurdAction.LIST:
          if (type === "emit") {
            prevListParams = values;
            handleSearch();
          }
          return;
        case CurdAction.ADD:
          if (type === "execute") {
            sendRequest(CurdAction.ADD, values, state.detailData);
          }
          return;
        case CurdAction.EDIT:
          if (type === "execute") {
            sendRequest(CurdAction.EDIT, values, state.detailData);
          }
          return;
        case CurdAction.DELETE:
          if (type === "emit") {
            sendRequest(CurdAction.DELETE, record, props.rowKey);
          }
          return;
      }
    });

    const operateMap = reduce(props.operates, (pair, item) => ({ ...pair, [item.action]: item }), {});

    //根据Action获取ICurdOperateOpts
    const getOperate = (action: ICurdAction): ICurdOperateOpts | undefined => {
      return get(operateMap, action);
    };

    provideProCurd({
      rowKey: props.rowKey!,
      curdState: state,
      formColumns,
      descColumns,
      tableColumns,
      searchColumns,
      //
      sendCurdEvent,
      //
      getOperate,
      //
      listProps: props.listProps,
      formProps: props.formProps,
      descProps: props.descProps,
      modalProps: props.modalProps,
    });

    return () => {
      return slots.default?.();
    };
  },
});

export type ProCurdProps = CurdProps &
  Omit<ProModuleProps, "state" | "requests"> & {
    curdState: UnwrapNestedRefs<ICurdState>;
  };

export const ProCurd = defineComponent<ProCurdProps>({
  props: {
    ...ProModule.props,
    ...Curd.props,
  },
  setup: (props, { slots }) => {
    const curdState: UnwrapNestedRefs<ICurdState> = props.curdState || reactive({ detailData: {} });

    /****************** 请求处理 **********************/
    //curd默认网络属性
    const curdOperateOpts: Record<ICurdAction, Omit<ICurdOperateOpts, "actor" | "action">> = {
      [CurdAction.LIST]: {
        convertParams: (values) => values,
        convertData: (actor) => actor.res?.data,
        loadingName: "listLoading",
        stateName: "listData",
      },
      [CurdAction.DETAIL]: {
        convertParams: (record, rowKey) => pick(record, rowKey),
        convertData: (actor) => actor.res?.data,
        loadingName: "detailLoading",
        stateName: "detailData",
        label: "详情",
      },
      [CurdAction.ADD]: {
        convertParams: (values, record) => ({ body: { ...record, ...values } }),
        loadingName: "operateLoading",
        label: "添加",
      },
      [CurdAction.EDIT]: {
        convertParams: (values, record) => ({ body: { ...record, ...values } }),
        loadingName: "operateLoading",
        label: "编辑",
      },
      [CurdAction.DELETE]: {
        convertParams: (values, record) => ({ body: { ...record, ...values } }),
        label: "删除",
      },
    };

    const requests = map(props.operates, (item) => {
      const curdOpts = get(curdOperateOpts, item.action!);
      return { ...curdOpts, ...item };
    });

    const moduleKeys = keys(ProModule.props);
    return () => {
      return h(
        ProModule,
        { ...pick(props, moduleKeys), state: curdState, requests },
        h(Curd, { ...omit(props, ...moduleKeys, "curdState") }, slots),
      );
    };
  },
});