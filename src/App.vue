<template>
  <div class="app-container">
    <StudentDashboard />
  </div>
</template>

<script setup>
import StudentDashboard from './components/StudentDashboard.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: #1a1a1a;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-container {
  min-height: 100vh;
  background-color: #1a1a1a;
}

/* 深色主题样式 */
.el-table {
  --el-table-bg-color: #2d2d2d;
  --el-table-tr-bg-color: #2d2d2d;
  --el-table-expanded-cell-bg-color: #2d2d2d;
}

.el-table .el-table__header-wrapper {
  background-color: #3a3a3a;
}

.el-table .el-table__row {
  background-color: #2d2d2d;
}

.el-table .el-table__row:hover {
  background-color: #3a3a3a;
}

.el-card {
  --el-card-bg-color: #2d2d2d;
  --el-card-border-color: #4a4a4a;
}

.el-pagination {
  --el-pagination-bg-color: #2d2d2d;
  --el-pagination-button-color: #ffffff;
}
</style>