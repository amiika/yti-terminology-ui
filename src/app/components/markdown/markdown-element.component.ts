import { Component, Input } from '@angular/core';
import { Node as MarkdownNode } from 'commonmark';
import { children } from './markdown-utils';

@Component({
  selector: '[markdown-element]',
  styleUrls: ['./markdown-element.component.scss'],
  template: `    
    <ng-container>
      <ng-container *ngFor="let child of children" [ngSwitch]="child.type">
      
        <p *ngSwitchCase="'paragraph'" markdown-element [node]="child"></p>
        <u *ngSwitchCase="'link'">{{child.firstChild.literal}}</u>
        <span *ngSwitchCase="'text'">{{child.literal}}</span>
      
      </ng-container>
    </ng-container>
  `
})
export class MarkdownElementComponent {

  @Input() node: MarkdownNode;

  get children() {
    return children(this.node);
  }
}
