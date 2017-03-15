import { Component, Input, AfterViewInit, OnInit, ElementRef, ViewChild, Renderer } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { Node } from '../entities/node';
import {
  filterAndSortSearchResults, labelComparator, scoreComparator, ContentExtractor,
  TextAnalysis
} from '../utils/text-analyzer';
import { isDefined } from '../utils/object';
import { LanguageService } from '../services/language.service';
import { TermedService } from '../services/termed.service';

@Component({
  selector: 'concept-list',
  styleUrls: ['./concept-list.component.scss'],
  template: `
    <div class="row">
      <div class="col-lg-12">
        <div class="input-group input-group-lg">
          <input #searchInput
                 [(ngModel)]="search"
                 type="text" 
                 class="form-control" 
                 [placeholder]="'search...' | translate" />
        </div>
      </div>
    </div>
  
    <div class="row">
      <div class="col-lg-12 search-results">
      
        <table class="table table-hover table-striped table-sm">
          <thead>
            <tr>
              <th translate>Preferred term</th>
              <th translate>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let concept of searchResults | async">
              <td>
                <a [routerLink]="['/concepts', concept.graphId, 'rootConcept', concept.id]" 
                   [innerHTML]="concept.label | translateSearchValue: debouncedSearch | highlight: debouncedSearch"></a>
                 </td>
              <td>{{concept.status | translate}}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class ConceptListComponent implements OnInit, AfterViewInit {

  @Input() graphId: string;
  @ViewChild('searchInput') searchInput: ElementRef;

  searchResults: Observable<Node<'Concept'>[]>;
  search$ = new BehaviorSubject('');
  _search = '';
  debouncedSearch = this._search;

  constructor(private languageService: LanguageService,
              private termedService: TermedService,
              private renderer: Renderer) {
  }

  get search() {
    return this._search;
  }

  set search(value: string) {
    this._search = value;
    this.search$.next(value);
  }

  ngOnInit() {

    const concepts$ = this.termedService.getConceptList(this.graphId)
      .publishReplay()
      .refCount();

    this.searchResults = Observable.combineLatest([concepts$, this.search$.debounceTime(500)], (concepts: Node<'Concept'>[], search: string) => {

      this.debouncedSearch = search;
      const scoreFilter = (item: TextAnalysis<Node<'Concept'>>) => !search || isDefined(item.matchScore) || item.score < 2;
      const labelExtractor: ContentExtractor<Node<'Concept'>> = concept => concept.label;
      const comparator = scoreComparator().andThen(labelComparator(this.languageService));

      return filterAndSortSearchResults(concepts, search, [labelExtractor], [scoreFilter], comparator);
    });
  }

  ngAfterViewInit() {
    this.renderer.invokeElementMethod(this.searchInput.nativeElement, 'focus');
  }
}
