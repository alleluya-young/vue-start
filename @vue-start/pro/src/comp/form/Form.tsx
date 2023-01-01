import { Ref, UnwrapNestedRefs } from "@vue/reactivity";
import { computed, defineComponent, ExtractPropTypes, inject, PropType, provide, reactive, ref } from "vue";
import { BooleanObjType, BooleanRulesObjType, TColumns, TElementMap } from "../../types";
import { useEffect } from "@vue-start/hooks";
import { forEach, get, keys, map, omit, size } from "lodash";
import { getColumnFormItemName, getFormItemEl, proBaseProps, ProBaseProps, useProConfig } from "../../core";
import { createExpose, getValidValues, mergeStateToList } from "../../util";
import { GridProps } from "../index";
import { provideProFormList } from "./FormList";

const ProFormKey = Symbol("pro-form");

export interface IProFormProvideExtra extends Record<string, any> {}

interface IProFormProvide extends IProFormProvideExtra {
  formState: UnwrapNestedRefs<Record<string, any>>;
  showState: UnwrapNestedRefs<Record<string, any>>;
  readonlyState: UnwrapNestedRefs<Record<string, any>>;
  disableState: UnwrapNestedRefs<Record<string, any>>;
  readonly: Ref<boolean | undefined>;
  //
  elementMap?: TElementMap;
  formElementMap?: TElementMap;
  //
  columns: Ref<TColumns>;
}

export const useProForm = (): IProFormProvide => inject(ProFormKey) as IProFormProvide;

const provideProForm = (ctx: IProFormProvide) => {
  provide(ProFormKey, ctx);
};

const proFormProps = () => ({
  /**
   * 同 antd 或 element  form中的model
   */
  model: { type: Object as PropType<UnwrapNestedRefs<Record<string, any>>> },
  /**
   *  子组件是否只读样式
   */
  readonly: { type: Boolean, default: undefined },
  /**
   *  FormComponent 根据此项来确定组件是否显示
   *  rules 根据rules中方法生成showState对象
   */
  showState: { type: Object as PropType<UnwrapNestedRefs<BooleanObjType>> },
  showStateRules: { type: Object as PropType<BooleanRulesObjType> },
  /**
   * 是否只读
   */
  readonlyState: { type: Object as PropType<UnwrapNestedRefs<BooleanObjType>> },
  readonlyStateRules: { type: Object as PropType<BooleanRulesObjType> },
  /**
   * 是否disabled
   */
  disableState: { type: Object as PropType<UnwrapNestedRefs<BooleanObjType>> },
  disableStateRules: { type: Object as PropType<BooleanRulesObjType> },
  /**
   * 是否启用rules验证
   */
  needRules: { type: Boolean, default: true },
  /**
   * provide传递
   */
  provideExtra: { type: Object as PropType<IProFormProvideExtra> },
});

export type ProFormProps = Partial<ExtractPropTypes<ReturnType<typeof proFormProps>>> & ProBaseProps;

export const createForm = (Form: any, Grid: any, formMethods: string[]): any => {
  return defineComponent<ProFormProps & Omit<GridProps, "items">>({
    inheritAttrs: false,
    props: {
      ...Form.props,
      ...proBaseProps,
      ...proFormProps(),
      ...omit(Grid.props, "items"),
    },
    setup: (props, { slots, emit, expose, attrs }) => {
      const { elementMap: elementMapP, formElementMap: formElementMapP } = useProConfig();

      const elementMap = props.elementMap || elementMapP;
      const formElementMap = props.formElementMap || formElementMapP;

      const formState = props.model || reactive({});
      //组件状态相关
      const showState = props.showState || reactive({});
      const readonlyState = props.readonlyState || reactive({});
      const disableState = props.disableState || reactive({});

      //formState改变情况下，更新 showState，readonlyState，disableState状态
      useEffect(() => {
        if (props.showStateRules) {
          forEach(props.showStateRules, (fn, key) => {
            showState[key] = fn(formState);
          });
        }
        if (props.readonlyStateRules) {
          forEach(props.readonlyStateRules, (fn, key) => {
            readonlyState[key] = fn(formState);
          });
        }
        if (props.disableStateRules) {
          forEach(props.disableStateRules, (fn, key) => {
            disableState[key] = fn(formState);
          });
        }
      }, formState);

      //readonly
      const readonly = computed(() => props.readonly);

      //columns合并
      const columns = computed(() =>
        mergeStateToList(props.columns!, props.columnState!, (item) => getColumnFormItemName(item)!),
      );

      const handleFinish = (values: Record<string, any>) => {
        //删除不显示的值再触发事件
        const showValues = getValidValues(values, showState, props.showStateRules);
        emit("finish", showValues, values);
      };

      const formRef = ref();

      expose(createExpose(formMethods, formRef));

      provideProForm({
        formState,
        showState,
        readonlyState,
        disableState,
        //
        elementMap,
        formElementMap,
        //
        readonly: readonly as any,
        //
        columns: columns as any,
        //
        formRef,
        //
        ...props.provideExtra,
      });

      //为了不warning ...
      provideProFormList({} as any);

      const invalidKeys = keys(proFormProps());
      const gridKeys = keys(omit(Grid.props, "items"));

      return () => {
        return (
          <Form
            ref={formRef}
            {...omit(attrs, "onFinish")}
            {...omit(props, ...invalidKeys, ...gridKeys, "onFinish")}
            model={formState}
            onFinish={handleFinish}
            v-slots={omit(slots, "default")}>
            {slots.start?.()}

            {formElementMap && size(columns.value) > 0 && (
              <>
                {props.row ? (
                  <Grid
                    row={props.row}
                    col={props.col}
                    items={map(columns.value, (item) => ({
                      rowKey: getColumnFormItemName(item),
                      vNode: getFormItemEl(formElementMap, item, props.needRules)!,
                      col: get(item, ["extra", "col"]),
                    }))}
                  />
                ) : (
                  map(columns.value, (item) => getFormItemEl(formElementMap, item, props.needRules))
                )}
              </>
            )}

            {slots.default?.()}
          </Form>
        );
      };
    },
  });
};