import { Component, Injectable, Input, OnInit } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConceptNode } from '../../entities/node';
import { FormNode, FormReferenceLiteral } from '../../services/form-state';

@Injectable()
export class SelectConceptReferenceModalService {

  constructor(private modalService: NgbModal) {
  }

  open(formNode: FormNode): Promise<FormReferenceLiteral<ConceptNode>> {
    const modalRef = this.modalService.open(SelectConceptReferenceModal, { size: 'sm' });
    const instance = modalRef.componentInstance as SelectConceptReferenceModal;
    instance.formNode = formNode;
    return modalRef.result;
  }
}

@Component({
  selector: 'select-concept-reference-modal',
  styleUrls: ['./select-concept-reference.modal.scss'],
  template: `
    <div class="modal-header">
      <h4 class="modal-title">
        <a><i class="fa fa-times" (click)="cancel()"></i></a>
        <span translate>Choose reference type</span>
      </h4>
    </div>
    <div class="modal-body">
      <div class="row">
        <div class="col-md-12">
          
          <p translate>Selected concept is not yet formally referenced. Choose the reference type.</p>

          <div class="form-group">
            <label for="status" translate>Reference type</label>
            <select id="status " class="form-control" [(ngModel)]="selection">
              <option *ngFor="let reference of conceptReferences" [ngValue]="reference">{{reference.label | translateValue}}</option>
            </select>
          </div>
          
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary cancel" (click)="cancel()" translate>Cancel</button>
      <button type="button" class="btn btn-default confirm" (click)="confirm()" translate>Select reference</button>
    </div>
  `
})
export class SelectConceptReferenceModal implements OnInit {

  @Input() formNode: FormNode;

  selection: FormReferenceLiteral<ConceptNode>;
  conceptReferences: FormReferenceLiteral<ConceptNode>[];

  constructor(public modal: NgbActiveModal) {
  }

  ngOnInit(): void {

    this.conceptReferences = this.formNode.references
      .filter(ref => ref.reference.targetType === 'Concept')
      .map(ref => ref.reference as FormReferenceLiteral<ConceptNode>);

    if (this.formNode.hasRelatedConcepts()) {
      this.selection = this.formNode.relatedConcepts;
    } else {
      this.selection = this.conceptReferences[0];
    }
  }

  cancel() {
    this.modal.dismiss('cancel');
  }

  confirm() {
    this.modal.close(this.selection);
  }
}
