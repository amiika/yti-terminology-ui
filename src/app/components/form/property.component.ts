import { Component, Input } from '@angular/core';
import { ConceptNode, Property } from '../../entities/node';
import { EditableService } from '../../services/editable.service';

@Component({
  selector: 'property',
  styleUrls: ['./property.component.scss'],
  template: `
    <dl *ngIf="show">
      <dt><label [for]="property.meta.id">{{property.meta.label | translateValue}}</label></dt>
      <dd [ngSwitch]="property.meta.type.type">
        <localized-input *ngSwitchCase="'localizable'" 
                         [property]="property"
                         [conceptSelector]="conceptSelector"
                         [relatedConcepts]="relatedConcepts"></localized-input>
        <literal-input *ngSwitchCase="'string'" [property]="property"></literal-input>
        <status-input *ngSwitchCase="'status'" [property]="property"></status-input>
        <span *ngSwitchDefault>ERROR - unknown property type</span>
      </dd>
    </dl>
  `
})
export class PropertyComponent {

  @Input('value') property: Property;
  @Input() conceptSelector: (name: string) => Promise<ConceptNode>;
  @Input() relatedConcepts: ConceptNode[] = [];

  constructor(private editableService: EditableService) {
  }

  get show() {
    return this.editableService.editing || !this.property.empty;
  }
}
