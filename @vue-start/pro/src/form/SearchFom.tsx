import { defineComponent, ExtractPropTypes, PropType } from "vue";
import { clone, debounce, filter, get, map, size, some } from "lodash";
import { useEffect, useWatch } from "@vue-start/hooks";
import { UnwrapNestedRefs } from "@vue/reactivity";
import { TColumns } from "../types";
import { getColumnFormItemName, getColumnValueType } from "../core";

export enum SearchMode {
  //自动触发搜索
  AUTO = "AUTO",
  //手动触发搜索
  MANUAL = "MANUAL",
}

export type ISearchMode = keyof typeof SearchMode;

const proSearchFormProps = () => ({
  /**
   * 需要监听的对象
   */
  model: { type: Object as PropType<UnwrapNestedRefs<Record<string, any>>>, required: true },
  /**
   * 初始化触发 onFinish
   */
  initEmit: { type: Boolean, default: true },
  /**
   *  模式 自动触发或者手动触发 onFinish
   */
  searchMode: { type: String as PropType<ISearchMode>, default: SearchMode.AUTO },
  /**
   * 配置 同ProForm中的columns
   * 可以根据column中valueType计算出默认的debounceKeys
   */
  columns: { type: Array as PropType<TColumns> },
  /**
   * 需要debounce处理的字段
   */
  debounceKeys: { type: Array as PropType<string[]> },
  debounceTime: { type: Number, default: 800 },
});

export type ProSearchFormProps = Partial<ExtractPropTypes<ReturnType<typeof proSearchFormProps>>>;

/**
 * 该组件只是个模式，最终返回null，不做任何渲染，应配合着ProForm的包装类一起使用
 * 针对传入的model（监听对象）做相应的finish（回调）处理
 */
export const ProSearchForm = defineComponent<ProSearchFormProps>({
  props: {
    ...proSearchFormProps(),
  } as any,
  setup: (props, { emit }) => {
    //根据column valueType 算出默认需要debounce处理的属性集合
    const defaultDebounceKeys = map(
      filter(props.columns, (column) => {
        const valueType = getColumnValueType(column);
        //默认input组件的触发事件需要debounce处理
        return valueType === "text";
      }),
      (column) => {
        return getColumnFormItemName(column);
      },
    );

    const handleFinish = () => {
      emit("finish");
    };

    const debounceFinish = debounce(() => {
      handleFinish();
    }, props.debounceTime);

    //初始化
    useEffect(() => {
      if (props.initEmit) {
        handleFinish();
      }
    }, []);

    const isDebounceDataChange = (
      state: Record<string, any>,
      prevState: Record<string, any>,
      debounceKeys: string[],
    ) => {
      return some(debounceKeys, (key) => {
        return get(state, key) !== get(prevState, key);
      });
    };

    //监听
    useWatch(
      (state, prevState) => {
        if (props.searchMode !== SearchMode.AUTO) {
          return;
        }
        //如果改变的值中包括debounceKeys中注册的 延时触发
        const debounceKeys = size(props.debounceKeys) > 0 ? props.debounceKeys : defaultDebounceKeys;
        if (size(debounceKeys) > 0 && isDebounceDataChange(state, prevState, debounceKeys as string[])) {
          debounceFinish();
          return;
        }
        handleFinish();
      },
      () => clone(props.model!),
    );

    return () => {
      return null;
    };
  },
});
