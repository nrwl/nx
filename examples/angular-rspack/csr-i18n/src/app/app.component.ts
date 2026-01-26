import { Component, computed, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';

@Component({
  imports: [RouterModule, CurrencyPipe, DatePipe],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  today = new Date();
  toggle = signal(true);
  toggleAriaLabel = computed(() => {
    return this.toggle()
      ? $localize`':Toggle Button|A button to toggle status:Show`
      : $localize`:Toggle Button|A button to toggle status:Hide`;
  });
  valueToInterpolate = 'Flying Cars';
  interpolatedTranslation = $localize`::interpolatedTranslation:This is an interpolated translation for ${this.valueToInterpolate}`;

  minutes = signal(0);
  gender = signal<'male' | 'female' | 'other'>('male');

  toggleDisplay = () => {
    this.toggle.update((v) => !v);
  };

  setTime(value: number) {
    this.minutes.set(value);
  }

  setGender(value: 'male' | 'female' | 'other') {
    this.gender.set(value);
  }
}
