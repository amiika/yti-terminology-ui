import { Component, OnInit, AfterViewInit, Renderer, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, BehaviorSubject } from 'rxjs';
import { TermedService } from '../services/termed.service';
import { LocationService } from '../services/location.service';
import { LanguageService } from '../services/language.service';
import { Node } from '../entities/node';
import {
  filterAndSortSearchResults, TextAnalysis, scoreComparator, labelComparator,
  ContentExtractor
} from '../utils/text-analyzer';
import { isDefined } from '../utils/object';

@Component({
  selector: 'concepts',
  styleUrls: ['./concepts.component.scss'],
  template: `
    <div class="container">

      <div class="row">
        <div class="col-md-12">
          <div class="page-header">
            <h1 *ngIf="conceptScheme">{{conceptScheme.meta.label | translateValue}}</h1>
          </div>
        </div>
      </div>
      <div class="row">
      
        <div class="col-md-4">
          <div class="input-group input-group-lg">
            <input #searchInput
                   [(ngModel)]="search"
                   type="text" 
                   class="form-control" 
                   [placeholder]="'search...' | translate" />
          </div>
        </div>
        
        <div class="col-md-8">
          
          <ul *ngIf="!loading">
            <li *ngFor="let concept of searchResults | async">
              <a [routerLink]="['concept', concept.id]" [innerHTML]="concept.label | translateSearchValue: search | highlight: search"></a>
            </li>
          </ul>
          
          <ajax-loading-indicator *ngIf="loading"></ajax-loading-indicator>
          
        </div>
      </div>
      
    </div>
  `
})
export class ConceptsComponent implements OnInit, AfterViewInit {

  loading = true;
  conceptScheme: Node<'ConceptScheme'>;
  searchResults: Observable<Node<'Concept'>[]>;
  search$ = new BehaviorSubject('');
  _search = '';

  @ViewChild('searchInput') searchInput: ElementRef;

  constructor(private route: ActivatedRoute,
              private renderer: Renderer,
              private termedService: TermedService,
              private locationService: LocationService,
              private languageService: LanguageService) {
  }

  get search() {
    return this._search;
  }

  set search(value: string) {
    this._search = value;
    this.search$.next(value);
  }

  ngOnInit() {

    const concepts = this.route.params.switchMap(params => this.termedService.getConceptList(params['graphId']))
      .publishReplay()
      .refCount();

    this.searchResults = Observable.combineLatest([concepts, this.search$.debounceTime(500)], (concepts: Node<'Concept'>[], search: string) => {

      const scoreFilter = (item: TextAnalysis<Node<'Concept'>>) => !search || isDefined(item.matchScore) || item.score < 2;
      const labelExtractor: ContentExtractor<Node<'Concept'>> = concept => concept.label;
      const comparator = scoreComparator().andThen(labelComparator(this.languageService));

      return filterAndSortSearchResults(concepts, search, [labelExtractor], [scoreFilter], comparator);
    });

    this.route.params.switchMap(params => this.termedService.getConceptScheme(params['graphId']))
      .subscribe(scheme => {
        this.conceptScheme = scheme;
        this.locationService.atConceptScheme(scheme);
      });

    concepts.subscribe(() => this.loading = false);
  }

  ngAfterViewInit() {
    this.renderer.invokeElementMethod(this.searchInput.nativeElement, 'focus');
  }
}
