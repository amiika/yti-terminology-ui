import { Component, Input } from '@angular/core';
import { Reference } from '../entities/node';

@Component({
  selector: 'reference',
  styleUrls: ['./reference.component.scss'],
  template: `
    <dl class="row">
      <dt class="col-md-3">{{reference.meta.label | translateValue}}</dt>
      <dd class="col-md-9">
        <terms *ngIf="reference.term" [value]="reference"></terms>
        <div *ngIf="!reference.term">
          <span *ngFor="let referenceNode of reference.values; let last = last">
            {{referenceNode.label | translateValue}}<span *ngIf="!last">, </span>
          </span>
        </div>
      </dd>
    </dl>
  `
})
export class ReferenceComponent {

  @Input('value') reference: Reference;
}
