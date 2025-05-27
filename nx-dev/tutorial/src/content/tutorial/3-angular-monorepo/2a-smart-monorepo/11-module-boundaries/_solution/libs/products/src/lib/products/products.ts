import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// This import is not allowed 👇
import { Orders } from '@angular-monorepo/orders';

@Component({
  selector: 'lib-products',
  imports: [CommonModule],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class Products {}
