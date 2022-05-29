import { TestBed } from '@angular/core/testing';
import { TemplatesService } from './templates.service';


describe('TemplateService', () => {
    let service: TemplatesService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(TemplatesService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
