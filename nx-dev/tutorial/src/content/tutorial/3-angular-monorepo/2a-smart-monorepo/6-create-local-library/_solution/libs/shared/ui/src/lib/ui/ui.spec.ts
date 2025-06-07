import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Ui } from './ui';

describe('Ui', () => {
  let component: Ui;
  let fixture: ComponentFixture<Ui>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ui],
    }).compileComponents();

    fixture = TestBed.createComponent(Ui);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
