import { defineComponent } from "vue";
import { ProPage as ProPageOrign } from "@vue-start/pro";
import { omit } from "lodash";

export const ProPage = defineComponent({
  props: {
    ...ProPageOrign.props,
  },
  setup: (props, { slots }) => {
    return () => {
      return (
        <ProPageOrign
          {...props}
          v-slots={{
            backIcon: () => (
              <el-button type={"primary"} link>
                &#8610;返回
              </el-button>
            ),
            ...omit(slots, "default"),
          }}>
          <div class={"page-content"}>{slots.default?.()}</div>
        </ProPageOrign>
      );
    };
  },
});
