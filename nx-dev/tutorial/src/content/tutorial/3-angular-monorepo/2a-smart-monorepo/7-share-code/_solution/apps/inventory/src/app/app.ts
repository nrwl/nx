import { Component } from '@angular/core';
import { Products } from '@angular-monorepo/products';

@Component({
  imports: [Products],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'inventory';
}
