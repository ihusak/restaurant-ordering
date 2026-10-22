import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-setup-page',
  template: `
    <h1>Setup</h1>
    <p>Manage categories and menu items. Changes appear in Menu immediately.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupPage {}
