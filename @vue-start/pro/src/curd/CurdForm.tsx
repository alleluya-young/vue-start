import { defineComponent, ExtractPropTypes, PropType, ref } from "vue";
import { useProModule } from "../core";
import { CurdAction, CurdAddAction, CurdCurrentMode, CurdSubAction, useProCurd } from "./ctx";
import { ICurdState } from "./Curd";
import { omit } from "lodash";

const proCurdAddOrEditProps = () => ({
  //是否使用operate bar
  operateBar: { type: Boolean, default: true },
  //显示 确定并继续 按钮
  showContinueAdd: { type: Boolean, default: false },
  //
  okText: { type: String, default: "确定" },
  okButtonProps: { type: Object as PropType<Record<string, any>> },
  //
  continueText: { type: String, default: "确定并继续" },
  continueButtonProps: { type: Object as PropType<Record<string, any>> },
});

export type ProCurdAddOrEditProps = Partial<ExtractPropTypes<ReturnType<typeof proCurdAddOrEditProps>>>;

export const createCurdForm = (
  Form: any,
  Button: any,
  convertFormProps?: (curdState: ICurdState) => Record<string, any>,
): any => {
  return defineComponent({
    props: {
      ...Form.props,
      ...proCurdAddOrEditProps(),
    },
    setup: (props, { slots }) => {
      const { elementMap, formElementMap } = useProModule();
      const { curdState, formColumns, sendCurdEvent } = useProCurd();

      const formRef = ref();

      const handleFinish = (values: Record<string, any>) => {
        if (curdState.mode === CurdCurrentMode.EDIT) {
          //edit
          sendCurdEvent({ action: CurdAction.EDIT, type: CurdSubAction.EXECUTE, values });
        } else {
          //add
          sendCurdEvent({ action: CurdAction.ADD, type: CurdSubAction.EXECUTE, values });
        }
      };

      const handleAdd = () => {
        curdState.addAction = CurdAddAction.NORMAL;
        formRef.value?.submit();
      };

      const handleContinueAdd = () => {
        curdState.addAction = CurdAddAction.CONTINUE;
        formRef.value?.submit();
      };

      return () => {
        return (
          <Form
            ref={formRef}
            {...props}
            elementMap={props.elementMap || elementMap}
            formElementMap={props.formElementMap || formElementMap}
            columns={formColumns.value}
            model={curdState.detailData}
            readonly={curdState.mode === CurdCurrentMode.DETAIL}
            onFinish={handleFinish}
            {...convertFormProps?.(curdState)}
            v-slots={omit(slots, "default", "divide", "operateStart", "operateCenter", "operateEnd")}>
            {slots.divide?.()}

            {props.operateBar && (
              <div class={"pro-curd-form-operate"}>
                {slots.operateStart?.()}

                {curdState.mode !== CurdCurrentMode.DETAIL && (
                  <Button onClick={handleAdd} {...props.okButtonProps} loading={curdState.operateLoading}>
                    {props.okText}
                  </Button>
                )}

                {slots.operateCenter?.()}

                {props.showContinueAdd && curdState.mode === CurdCurrentMode.ADD && (
                  <Button onClick={handleContinueAdd} {...props.continueButtonProps} loading={curdState.operateLoading}>
                    {props.continueText}
                  </Button>
                )}

                {slots.operateEnd?.()}
              </div>
            )}

            {slots.default?.()}
          </Form>
        );
      };
    },
  });
};
