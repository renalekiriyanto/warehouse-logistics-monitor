import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import MenuView from '../views/MenuView.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
  },
  {
    path: '/menu/:menuKey',
    name: 'menu',
    component: MenuView,
  },
  // Catch all unknown redirects to Dashboard
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});
