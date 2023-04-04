/*---
title: button
---*/

import { defineComponent, ref } from "vue";
import { options } from "@/common/columns";

export default defineComponent(() => {
  const valueRef = ref();

  return () => {
    return <pro-radio v-model={valueRef.value} options={options} optionType={"button"} />;
  };
});
