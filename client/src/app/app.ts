import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ConnectionIndicator } from './core/connection-indicator';
import { APP_NAME } from './core/page-title.strategy';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    ConnectionIndicator,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly appName = APP_NAME;
  protected readonly links: readonly NavLink[] = [
    { path: '/menu', label: 'Menu', icon: 'restaurant_menu' },
    { path: '/setup', label: 'Setup', icon: 'tune' },
    { path: '/orders', label: 'Orders', icon: 'receipt_long' },
  ];
}
