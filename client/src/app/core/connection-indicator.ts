import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { connectionFeature } from '../state/realtime/connection.reducer';
import type { ConnectionStatus } from '../state/realtime/connection.reducer';

const VIEW: Record<ConnectionStatus, { icon: string; label: string }> = {
  connecting: { icon: 'sync', label: 'Connecting…' },
  online: { icon: 'cloud_done', label: 'Live' },
  reconnecting: { icon: 'sync_problem', label: 'Reconnecting…' },
  offline: { icon: 'cloud_off', label: 'Offline' },
};

@Component({
  selector: 'app-connection-indicator',
  imports: [MatIconModule],
  template: `
    <span class="indicator" [class]="status()" role="status" [attr.title]="hint()">
      <mat-icon aria-hidden="true">{{ view().icon }}</mat-icon>
      <span class="label">{{ view().label }}</span>
    </span>
  `,
  styles: `
    .indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 16px;
      font: var(--mat-sys-label-large);
    }
    .online {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .connecting,
    .reconnecting {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .offline {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    @media (max-width: 600px) {
      .label {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionIndicator {
  protected readonly status = inject(Store).selectSignal(connectionFeature.selectStatus);
  protected readonly view = computed(() => VIEW[this.status()]);
  protected readonly hint = computed(() =>
    this.status() === 'online' ? 'Menu and orders update in real time' : 'Showing the last known data',
  );
}
