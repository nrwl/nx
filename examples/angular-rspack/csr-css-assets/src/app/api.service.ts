import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  getGreeting(name: string): Observable<string> {
    return this.http
      .get<{ message: string }>(`/api/${name}`)
      .pipe(map((response) => response.message));
  }
}
