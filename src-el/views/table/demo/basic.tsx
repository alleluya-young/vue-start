/*---
title: 基础使用
---*/
import { defineComponent } from "vue";
import { columns, dataSource } from "@el/common/columns";

export default defineComponent(() => {
  return () => {
    return <pro-table columns={columns} dataSource={dataSource} />;
  };
});
