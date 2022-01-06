# Angular Nx Tutorial - Step 4: Connect to an API

<iframe width="560" height="315" src="https://www.youtube.com/embed/digMpZzPtg8" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Real-world applications do not live in isolation — they need APIs to talk to. Setup your app to talk to an API.

**Open `apps/todos/src/app/app.module.ts` to import `HttpClientModule`.**

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

**Now, use `HttpClient` in the component to get the data from the api.**

```typescript
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Todo {
  title: string;
}

@Component({
  selector: 'myorg-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  todos: Todo[] = [];

  constructor(private http: HttpClient) {
    this.fetch();
  }

  fetch() {
    this.http.get<Todo[]>('/api/todos').subscribe((t) => (this.todos = t));
  }

  addTodo() {
    this.http.post('/api/addTodo', {}).subscribe(() => {
      this.fetch();
    });
  }
}
```

## What's Next

- Continue to [Step 5: Add Node Application Implementing an API](/angular-tutorial/05-add-node-app)
