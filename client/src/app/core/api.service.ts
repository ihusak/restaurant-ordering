import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  Category,
  CategoryInput,
  CategoryPatch,
  CreateOrderRequest,
  MenuItem,
  MenuItemInput,
  MenuItemPatch,
  MenuSnapshot,
  Order,
  OrdersSnapshot,
} from '@shared';

/** Typed access to the REST API. The request and response types come from `shared`. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getMenu(): Observable<MenuSnapshot> {
    return this.http.get<MenuSnapshot>('/api/menu');
  }

  getOrders(): Observable<OrdersSnapshot> {
    return this.http.get<OrdersSnapshot>('/api/orders');
  }

  createCategory(input: CategoryInput): Observable<Category> {
    return this.http.post<Category>('/api/categories', input);
  }

  updateCategory(id: string, patch: CategoryPatch): Observable<Category> {
    return this.http.patch<Category>(`/api/categories/${encodeURIComponent(id)}`, patch);
  }

  deleteCategory(id: string): Observable<null> {
    return this.http.delete<null>(`/api/categories/${encodeURIComponent(id)}`);
  }

  createItem(input: MenuItemInput): Observable<MenuItem> {
    return this.http.post<MenuItem>('/api/items', input);
  }

  updateItem(id: string, patch: MenuItemPatch): Observable<MenuItem> {
    return this.http.patch<MenuItem>(`/api/items/${encodeURIComponent(id)}`, patch);
  }

  deleteItem(id: string): Observable<null> {
    return this.http.delete<null>(`/api/items/${encodeURIComponent(id)}`);
  }

  placeOrder(request: CreateOrderRequest): Observable<Order> {
    return this.http.post<Order>('/api/orders', request);
  }
}
