import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { assertNever } from '../utils/object';
import { allMatching, anyMatching, firstMatching, flatten, normalizeAsArray } from "app/utils/array";
import { ConceptNode, KnownNode, Node, Property, Reference, TermNode } from '../entities/node';
import {
  Cardinality, EditorType, MetaModel, NodeMeta, PropertyMeta, ReferenceMeta,
  ReferenceType
} from '../entities/meta';
import { Localizable } from '../entities/localization';
import { NodeType } from "app/entities/node-api";
import { children } from '../utils/markdown';
import { Parser, Node as MarkdownNode } from 'commonmark';
import { validateMeta } from '../directives/validators/meta-model.validator';
import { requiredList } from '../directives/validators/required-list.validator';

export type FormReference = FormReferenceLiteral<any>
                          | FormReferenceTerm;

export type FormProperty = FormPropertyLiteral
                         | FormPropertyLiteralList
                         | FormPropertyLocalizable;

export class FormNode {

  control = new FormGroup({});
  properties: { property: FormProperty, name: string }[] = [];
  references: { reference: FormReference, name: string }[] = [];

  constructor(private node: Node<any>, public languagesProvider: () => string[]) {

    const createFormReference = (name: string, reference: Reference<any>) => {
      if (reference.term) {
        return new FormReferenceTerm(reference, languagesProvider);
      } else {
        return new FormReferenceLiteral(reference);
      }
    };

    const createFormProperty = (property: Property) => {

      switch (property.meta.type.type) {
        case 'localizable':
          const fixed = node.type === 'Term' && property.meta.id === 'prefLabel';
          return new FormPropertyLocalizable(property, languagesProvider, fixed);
        case 'string':
          switch (property.meta.type.cardinality) {
            case 'single':
              return new FormPropertyLiteral(property);
            case 'multiple':
              return new FormPropertyLiteralList(property);
            default:
              return assertNever(property.meta.type.cardinality);
          }
        default:
          return assertNever(property.meta.type);
      }
    };

    for (const [name, prop] of Object.entries(node.properties)) {
      const property = createFormProperty(prop);
      this.control.addControl('property-' + name, property.control);
      this.properties.push({property, name});
    }

    for (const [name, ref] of Object.entries(node.references)) {
      const reference = createFormReference(name, ref);
      this.control.addControl('reference-' + name, reference.control);
      this.references.push({reference, name});
    }
  }

  get prefLabelProperty(): { lang: string, value: string }[] {

    const label = firstMatching(this.properties, child => child.name === 'prefLabel');

    if (!label) {
      throw new Error('prefLabel not found in properties');
    }

    if (!(label.property instanceof FormPropertyLocalizable)) {
      throw new Error('prefLabel is not localizable');
    }

    return (label.property as FormPropertyLocalizable).value;
  }

  hasConceptReference(conceptId: string) {
    return anyMatching(this.referencedConcepts, concept => concept.id === conceptId);
  }

  hasRelatedConcepts() {
    return anyMatching(this.references, child => child.name === 'related');
  }

  get relatedConcepts() {
    return firstMatching(this.references, child => child.name === 'related')!.reference as FormReferenceLiteral<ConceptNode>;
  }

  get referencedConcepts(): ConceptNode[] {
    return flatten(this.references
      .filter(child => child.reference.targetType === 'Concept')
      .map(child => child.reference.value as ConceptNode[])
    );
  }

  get markdownProperties(): FormProperty[] {
    return this.properties
      .map(child => child.property)
      .filter(p => p.editorType === 'markdown');
  }

  removeMarkdownReferences(concept: ConceptNode) {
    for (const property of this.markdownProperties) {
      property.removeMarkdownReferencesTo(concept);
    }
  }

  get hasNonEmptyPrefLabel(): boolean {
    const prefLabel = firstMatching(this.properties, property => property.name === 'prefLabel');
    return !!prefLabel && !prefLabel.property.valueEmpty;
  }

  get value(): Node<any> {
    const result = this.node.clone();
    this.assignChanges(result);
    return result;
  }

  assignChanges(node: Node<any>) {

    for (const {property, name} of this.properties) {
      property.assignChanges(node.properties[name]);
    }

    for (const {reference, name} of this.references) {
      reference.assignChanges(node.references[name]);
    }
  }
}

export class FormReferenceLiteral<N extends KnownNode | Node<any>>{

  type: 'literal' = 'literal';
  control: FormControl;
  private meta: ReferenceMeta;
  private targetMeta: NodeMeta;

  constructor(reference: Reference<N>) {

    this.meta = reference.meta;

    function mapValue(values: N[]): N|N[]|null {
      switch (values.length) {
        case 0:
          return null;
        case 1:
          return values[0];
        default:
          return values;
      }
    }

    this.control = new FormControl(mapValue(reference.values), this.required ? [Validators.required] : []);
    this.targetMeta = reference.targetMeta;
  }

  get label(): Localizable {
    return this.meta.label;
  }

  get required(): boolean {
    return this.meta.required;
  }

  get referenceType(): ReferenceType {
    return this.meta.referenceType;
  }

  get targetType(): NodeType {
    return this.meta.targetType;
  }

  addReference(target: N) {
    this.control.setValue([...this.value, ...[target]]);
  }

  get graphId() {
    return this.meta.graphId;
  }

  get value(): N[] {
    return normalizeAsArray(this.control.value);
  }

  get singleValue(): N|null {
    if (this.value.length === 0) {
      return null;
    } else if (this.value.length === 1) {
      return this.value[0];
    } else {
      throw new Error('Multiple values when single is required: ' + this.value.length);
    }
  }

  set singleValue(value: N|null) {
    this.control.setValue(value);
  }

  get targetGraph() {
    return this.targetMeta.graphId;
  }

  get term() {
    return false;
  }

  get valueEmpty(): boolean {
    return this.value.length === 0;
  }

  assignChanges(reference: Reference<any>) {
    reference.values = this.value;
  }
}

export class FormReferenceTerm {

  type: 'term' = 'term';
  control: FormGroup;
  children: { formNode: FormNode, language: string }[];
  private meta: ReferenceMeta;
  private targetMeta: NodeMeta;

  constructor(reference: Reference<TermNode>, public languagesProvider: () => string[]) {

    this.meta = reference.meta;
    this.targetMeta = reference.targetMeta;
    this.control = this.required ? new FormGroup({}, requiredList) : new FormGroup({});

    this.children = reference.values
      .filter(term => term.hasLocalization())
      .map(term => ({ formNode: new FormNode(term, languagesProvider), language: term.language! }));

    this.children.forEach((child, index) => {
      this.control.addControl(index.toString(), child.formNode.control);
    });
  }

  get addedLanguages() {
    return Array.from(new Set(this.children.map(c => c.language)));
  }

  get label(): Localizable {
    return this.meta.label;
  }

  get referenceType(): ReferenceType {
    return this.meta.referenceType;
  }

  get targetType(): NodeType {
    return this.meta.targetType;
  }

  get required(): boolean {
    return this.meta.required;
  }

  get cardinality() {
    return this.meta.cardinality;
  }

  get graphId() {
    return this.meta.graphId;
  }

  get value(): TermNode[] {
    return this.children.map(child => child.formNode.value as TermNode);
  }

  addTerm(metaModel: MetaModel, language: string) {
    const newTerm = Node.create(this.targetMeta.createEmptyNode(), metaModel, false) as TermNode;
    newTerm.setLocalization(language, '');
    const newChild = { formNode: new FormNode(newTerm, this.languagesProvider), language: language };
    this.children.push(newChild);
    this.control.addControl((this.children.length - 1).toString(), newChild.formNode.control);
  }

  remove(child: { formNode: FormNode, language: string }) {
    removeChild(this.children, child, this.control);
  }

  get term() {
    return true;
  }

  get valueEmpty(): boolean {
    return this.value.length === 0;
  }

  assignChanges(reference: Reference<any>) {
    reference.values = this.value;
  }
}

export class FormPropertyLiteral {

  type: 'literal' = 'literal';
  control: FormControl;
  private meta: PropertyMeta;

  constructor(property: Property) {

    this.meta = property.meta;
    this.control = this.createControl(property.literalValue);
  }

  get required(): boolean {
    return this.meta.type.required;
  }

  private createControl(initial: string) {

    const isStatus = this.meta.type.editorType === 'status';
    const validators: ValidatorFn[] = [(control: FormControl) => validateMeta(control, this.meta)];

    if (this.required) {
      validators.push(Validators.required);
    }

    return new FormControl((!initial && isStatus) ? 'Unstable' : initial, validators);
  }

  get label(): Localizable {
    return this.meta.label;
  }

  get editorType(): EditorType {
    return this.meta.type.editorType;
  }

  get value() {
    return this.control.value;
  }

  get valueIsLocalizationKey() {
    return this.meta.type.editorType === 'status';
  }

  get multiColumn() {
    return this.meta.multiColumn;
  }

  get valueEmpty() {
    return this.value.trim() === '';
  }

  removeMarkdownReferencesTo(concept: ConceptNode) {
    this.control.setValue(removeMarkdownReferencesTo(this.value, concept));
  }

  assignChanges(property: Property) {

    const regex = this.meta.regex;
    property.attributes = [{ lang: '', value: this.value, regex }];
  }
}

export class FormPropertyLiteralList {

  type: 'literal-list' = 'literal-list';
  control: FormGroup;
  children: FormControl[];
  private meta: PropertyMeta;

  constructor(property: Property) {

    this.meta = property.meta;
    this.control = this.required ? new FormGroup({}, requiredList) : new FormGroup({});
    this.children = property.attributes.map(a => a.value).map(value => this.createChildControl(value));

    this.children.forEach((control, index) => {
      this.control.addControl(index.toString(), control);
    });
  }

  private createChildControl(initial: string): FormControl {

    const validators: ValidatorFn[] = [(control: FormControl) => validateMeta(control, this.meta)];

    if (this.required) {
      validators.push(Validators.required);
    }

    return new FormControl(initial, validators);
  }

  get label(): Localizable {
    return this.meta.label;
  }

  get required(): boolean {
    return this.meta.type.required;
  }

  get editorType(): EditorType {
    return this.meta.type.editorType;
  }

  get value(): string[] {
    return this.children.map(control => control.value);
  }

  get valueAsString() {
    return this.value.join(',');
  }

  append(initial: string) {
    const control = this.createChildControl(initial);
    this.children.push(control);
    this.control.addControl((this.children.length - 1).toString(), control);
  }

  remove(child: FormControl) {
    removeChild(this.children, child, this.control);
  }

  removeMarkdownReferencesTo(concept: ConceptNode) {
    for (const child of this.children) {
      child.setValue(removeMarkdownReferencesTo(child.value, concept));
    }
  }

  get multiColumn() {
    return this.meta.multiColumn;
  }

  get valueEmpty() {
    return allMatching(this.value, v => v.trim() === '');
  }

  assignChanges(property: Property) {

    const regex = this.meta.regex;
    property.attributes = this.value.map(value => ({ lang: '', value, regex }));
  }
}

export class FormPropertyLocalizable {

  type: 'localizable' = 'localizable';
  control: FormGroup;
  children: { lang: string, control: FormControl }[];
  private meta: PropertyMeta;

  constructor(property: Property, private languagesProvider: () => string[], public fixed: boolean) {

    this.meta = property.meta;
    this.control = this.required ? new FormGroup({}, requiredList) : new FormGroup({});
    this.children = property.attributes.map(attribute => ({
      lang: attribute.lang,
      control: this.createChildControl(attribute.value)
    }));

    this.children.forEach((control, index) => {
      this.control.addControl(index.toString(), control.control);
    });
  }

  get languages() {
    return this.languagesProvider();
  }

  private createChildControl(initial: string): FormControl {

    const validators: ValidatorFn[] = [(control: FormControl) => validateMeta(control, this.meta)];

    if (this.required) {
      validators.push(Validators.required);
    }

    return new FormControl(initial, validators);
  }

  get addedLanguages() {
    return Array.from(new Set(this.value.map(v => v.lang)));
  }

  get label(): Localizable {
    return this.meta.label;
  }

  get required(): boolean {
    return this.meta.type.required;
  }

  get editorType(): EditorType {
    return this.meta.type.editorType;
  }

  get cardinality(): Cardinality {
    return this.meta.type.cardinality;
  }

  get value(): { lang: string, value: string }[] {
    return this.children.map(({ lang, control }) => ({ lang, value: control.value }));
  }

  append(lang: string, initial: string) {
    const control = this.createChildControl(initial);
    this.children.push({lang, control});
    this.control.addControl((this.children.length - 1).toString(), control);
  }

  remove(child: { lang: string, control: FormControl }) {
    removeChild(this.children, child, this.control);
  }

  removeMarkdownReferencesTo(concept: ConceptNode) {
    for (const child of this.children) {
      child.control.setValue(removeMarkdownReferencesTo(child.control.value, concept));
    }
  }

  get multiColumn() {
    return this.meta.multiColumn;
  }

  get valueEmpty() {
    return allMatching(this.value, v => v.value.trim() === '');
  }

  assignChanges(property: Property) {

    const regex = this.meta.regex;
    property.attributes = this.value.map(localization => ({ lang: localization.lang, value: localization.value, regex }));
  }
}

function removeChild<T>(children: T[], child: T, parentGroup: FormGroup) {
  let removeIndex: number | null = null;

  for (let i = 0; i < children.length; i++) {
    if (children[i] === child) {
      removeIndex = i;
      break;
    }
  }

  if (removeIndex === null) {
    throw new Error('Child not found');
  }

  children.splice(removeIndex, 1);
  parentGroup.removeControl(removeIndex.toString());
}

// TODO: unify with other markdown printing algorithms
function removeMarkdownReferencesTo(value: string, concept: ConceptNode): string {

  let result = '';
  let referenceRemoved = false;

  const visit = (node: MarkdownNode) => {

    switch (node.type) {
      case 'paragraph':
        result += '\n\n';
        break;
      case 'link':
        if (concept.isTargetOfLink(node.destination)) {
          result += node.firstChild.literal;
          referenceRemoved = true;
        } else {
          result += `[${node.firstChild.literal}](${node.destination})`;
        }
        return;
    }

    if (node.literal) {
      result += node.literal;
    }

    for (const child of children(node)) {
      visit(child);
    }
  };

  visit(new Parser().parse(value));

  return referenceRemoved ? result : value;
}
