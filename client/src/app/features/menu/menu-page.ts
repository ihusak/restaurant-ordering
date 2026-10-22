import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { MenuActions } from '../../state/menu/menu.actions';
import { menuFeature } from '../../state/menu/menu.reducer';

@Component({
  selector: 'app-menu-page',
  imports: [MatButtonModule, MatProgressBarModule],
  template: `
    <h1>Menu</h1>
    @switch (status()) {
      @case ('loaded') {
        <p>
          {{ stats().items }} items in {{ stats().categories }} categories,
          {{ stats().available }} available.
        </p>
      }
      @case ('error') {
        <p role="alert">{{ error() }}</p>
        <button mat-stroked-button type="button" (click)="reload()">Try again</button>
      }
      @default {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the menu" />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuPage {
  private readonly store = inject(Store);
  protected readonly status = this.store.selectSignal(menuFeature.selectStatus);
  protected readonly error = this.store.selectSignal(menuFeature.selectError);
  protected readonly stats = this.store.selectSignal(menuFeature.selectStats);

  protected reload(): void {
    this.store.dispatch(MenuActions.load());
  }
}
