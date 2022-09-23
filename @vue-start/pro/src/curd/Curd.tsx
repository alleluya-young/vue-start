import { computed, defineComponent, ExtractPropTypes, PropType, reactive, ref, VNode } from "vue";
import { IProModuleProvide, IRequestOpts, ProModule, ProModuleProps, useModuleEvent, useProModule } from "../core";
import { filter, get, keys, map, omit, pick, reduce, sortBy } from "lodash";
import { TActionEvent, TColumn, TColumns, TElementMap } from "../types";
import { UnwrapNestedRefs } from "@vue/reactivity";
import {
  CurdAction,
  CurdSubAction,
  ICurdAction,
  ICurdAddAction,
  ICurdCurrentMode,
  ICurdSubAction,
  provideProCurd,
} from "./ctx";
import { IOperateItem } from "../table";
import { IRequestActor } from "@vue-start/request";
import { mergeStateToList } from "../util";
import { getColumnFormItemName, getFormItemEl, getItemEl } from "../core";

export type TPageState = {
  page: number;
  pageSize: number;
};

export const defaultPage: TPageState = {
  page: 1,
  pageSize: 10,
};

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
export interface ICurdOperateOpts extends Omit<IRequestOpts, "actor" | "action">, Omit<IOperateItem, "value"> {
  action: ICurdAction; //类型，由当前程序赋值
  actor?: IRequestActor;
}

export type TCurdActionEvent = {
  //action类型
  action: ICurdAction;
  //add、edit 存在execute类型事件
  type: ICurdSubAction;
  record?: Record<string, any>;
  values?: Record<string, any>;
  //
  source?: TActionEvent["source"];
};

const proCurdProps = () => ({
  /**
   * 配置（静态）
   */
  columns: { type: Array as PropType<TColumns> },
  /**
   * 配置（动态）
   * columns动态属性兼容
   */
  columnState: { type: Object as PropType<Record<string, any>> },
  /**
   * 录入组件集
   */
  formElementMap: { type: Object as PropType<TElementMap> },
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

export const CurdMethods = ["sendCurdEvent", "refreshList", "sendEvent", "sendRequest"];

const Curd = defineComponent<CurdProps>({
  props: {
    ...(proCurdProps() as any),
  },
  setup: (props, { slots, expose }) => {
    const { elementMap, state, sendEvent, sendRequest } = useProModule() as Omit<IProModuleProvide, "state"> & {
      state: ICurdState;
    };

    /**
     * columns columnState 合并
     */
    const columns = computed(() => {
      return mergeStateToList(props.columns!, props.columnState!, (item) => getColumnFormItemName(item)!);
    });

    /*********************************** 渲染组件 ***************************************/

    // 获取FormItem VNode
    const getFormItemVNode = (column: TColumn, needRules: boolean | undefined = true): VNode | null => {
      return getFormItemEl(props.formElementMap, column, needRules);
    };

    // 获取Item VNode
    const getItemVNode = (column: TColumn, value: any): VNode | null => {
      return getItemEl(elementMap, column, value);
    };

    /**
     * ${signName} 配置为true 会被选择
     * @param signName
     * @param opposite 如果为true，未配置（undefined）会被选择
     */
    const getSignColumns = (signName: string, opposite?: boolean) => {
      const signColumns = filter(columns.value, (item) => {
        const sign = get(item, ["extra", signName]) || get(item, signName);
        if (opposite) {
          //不为false 即为选中
          return sign !== false;
        }
        //只有true 才为选中
        return sign;
      });
      return sortBy(signColumns, (item) => {
        return get(item, ["extra", `${signName}Sort`]) || get(item, `${signName}Sort`);
      });
    };

    const formColumns = computed(() => getSignColumns("form", true));
    const descColumns = computed(() => getSignColumns("detail", true));
    const tableColumns = computed(() => getSignColumns("table", true));
    const searchColumns = computed(() => getSignColumns("search"));

    /******************************** 逻辑 *************************************/

    //上一次发起列表请求的参数
    let prevListParams: Record<string, any> | undefined;
    //刷新列表
    const handleSearch = (extra?: Record<string, any>) => {
      sendRequest(CurdAction.LIST, { ...prevListParams, ...extra });
    };

    //发送事件
    const sendCurdEvent = (event: TCurdActionEvent) => {
      sendEvent({ type: event.action, payload: omit(event, "action", "source"), source: event.source });
    };

    //事件订阅
    useModuleEvent((event) => {
      //如果当前event存在source 不处理
      if (event.source) {
        return;
      }
      const action = event.type as ICurdAction;

      const { type, values, record } = event.payload as Omit<TCurdActionEvent, "action">;

      switch (action) {
        case CurdAction.LIST:
          if (type === CurdSubAction.EMIT) {
            prevListParams = values;
            handleSearch();
          }
          return;
        case CurdAction.ADD:
          if (type === CurdSubAction.EXECUTE) {
            sendRequest(CurdAction.ADD, values, state.detailData);
          }
          return;
        case CurdAction.EDIT:
          if (type === CurdSubAction.EXECUTE) {
            sendRequest(CurdAction.EDIT, values, state.detailData);
          }
          return;
        case CurdAction.DELETE:
          if (type === CurdSubAction.EMIT) {
            sendRequest(CurdAction.DELETE, record, props.rowKey);
          }
          return;
      }
      //非 CurdAction 五种操作的其他请求
      if (action && type === CurdSubAction.EXECUTE) {
        sendRequest(action, values);
      }
    });

    const operateMap = reduce(props.operates, (pair, item) => ({ ...pair, [item.action]: item }), {});

    //根据Action获取ICurdOperateOpts
    const getOperate = (action: ICurdAction): ICurdOperateOpts | undefined => {
      return get(operateMap, action);
    };

    const listProps = computed(() => props.listProps);
    const formProps = computed(() => props.formProps);
    const descProps = computed(() => props.descProps);
    const modalProps = computed(() => props.modalProps);

    provideProCurd({
      columns,
      getSignColumns,
      getFormItemVNode,
      getItemVNode,
      elementMap,
      formElementMap: props.formElementMap!,
      //
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
      refreshList: handleSearch,
      //
      listProps,
      formProps,
      descProps,
      modalProps,
    });

    expose({ sendCurdEvent, refreshList: handleSearch });

    return () => {
      return slots.default?.();
    };
  },
});

export type ProCurdProps = CurdProps &
  Omit<ProModuleProps, "state" | "requests"> & {
    curdState?: UnwrapNestedRefs<ICurdState>;
  };

export const ProCurd = defineComponent<ProCurdProps>({
  props: {
    ...omit(ProModule.props, "state", "requests"),
    ...Curd.props,
    curdState: { type: Object as PropType<ICurdState> },
  },
  setup: (props, { slots, expose }) => {
    const moduleRef = ref();
    const curdRef = ref();

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
        convertParams: (record, rowKey) => pick(record, rowKey),
        label: "删除",
      },
    };

    /****************************** columns分类 *************************************/

    const operates = map(props.operates, (item) => {
      const curdOpts = get(curdOperateOpts, item.action!);
      return { ...curdOpts, ...item };
    });
    //只取配置actor的项
    const requests = filter(operates, (item) => item.actor);

    const moduleKeys = keys(omit(ProModule.props, "state", "requests"));

    expose({
      sendCurdEvent: (event: TCurdActionEvent) => {
        curdRef.value?.sendCurdEvent(event);
      },
      refreshList: (extra?: Record<string, any>) => {
        curdRef.value?.refreshList(extra);
      },
      sendEvent: (action: TActionEvent) => {
        moduleRef.value?.sendEvent(action);
      },
      sendRequest: (requestNameOrAction: string, ...params: any[]) => {
        moduleRef.value?.sendEvent(requestNameOrAction, ...params);
      },
    });

    return () => {
      return (
        <ProModule ref={moduleRef} {...pick(props, moduleKeys)} state={curdState} requests={requests as any}>
          <Curd
            ref={curdRef}
            {...omit(props, ...moduleKeys, "curdState", "operates")}
            operates={operates}
            v-slots={slots}
          />
        </ProModule>
      );
    };
  },
});
