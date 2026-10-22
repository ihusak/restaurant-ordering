import type { Routes } from '@angular/router';

// Every page is lazy loaded: the first screen only downloads what it needs.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'menu' },
  {
    path: 'menu',
    title: 'Menu',
    loadComponent: () => import('./features/menu/menu-page').then((m) => m.MenuPage),
  },
  {
    path: 'setup',
    title: 'Setup',
    loadComponent: () => import('./features/setup/setup-page').then((m) => m.SetupPage),
  },
  {
    path: 'orders',
    title: 'Orders',
    loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
  },
  { path: '**', redirectTo: 'menu' },
];
