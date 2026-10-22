import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-menu-page',
  template: `
    <h1>Menu</h1>
    <p>Browse the menu, build a cart and place an order.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuPage {}
