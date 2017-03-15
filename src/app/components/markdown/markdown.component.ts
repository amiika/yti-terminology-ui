import { Component, Input, OnInit, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { Parser, Node as MarkdownNode } from 'commonmark';
import { children, logUnsupportedNodes, removeWhiteSpaceNodes } from './markdown-utils';

const supportedNodeTypes = ['document', 'paragraph', 'link', 'text'];
const parser = new Parser();

@Component({
  selector: '[markdown]',
  template: `
    <div #self>
      <div markdown-element [node]="node"></div>
    </div>
  `
})
export class MarkdownComponent implements OnInit, AfterViewChecked {

  @Input() value: string;
  node: MarkdownNode;

  @ViewChild('self') self: ElementRef;

  ngOnInit() {
    this.node = parser.parse(this.value);
    logUnsupportedNodes(this.node, supportedNodeTypes);
  }

  ngAfterViewChecked() {
    removeWhiteSpaceNodes(this.self.nativeElement as HTMLElement);
  }
}

@Component({
  selector: '[markdown-element]',
  styleUrls: ['./markdown.component.scss'],
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
