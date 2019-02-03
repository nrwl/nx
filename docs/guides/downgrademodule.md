# Creating an AngularJS Downgrade Module

While NgUpgrade provides a way to run Angular and AngularJS code side by side and bridge the dependency injection systems, it does take a bit of a performance hit. Reason being, you end up having both change detection systems running at the same time regardless of if you are hitting Angular or AngularJS code.

The Angular upgrade package provides a way to do "NgUpgrade Lite", which is the concept of running AngularJS and downgrading Angular to run when needed, as well as keeping the change detection systems separate. Angular change detection will only run on Angular code and AngularJS scope digest will only run on AngularJS code.

For finer grain control over application performance during conversion to Angular, the downgrade module approach is a good choice.

Setting up a Downgrade Module manually involves several steps and is easy to misconfigure. **Nx** provides a command that does it for you.

```console
ng generate downgrade-module legacyApp --app=myapp
```

This will configure the `AppModule` to not bootstrap the `AppComponent` and instead set it up as an entry component. It will also configure `main.ts` to bootstrap AngularJS and use the `downgradeModule` to downgrade the Angular `AppModule` to run in AngularJS.

Open `main.ts` and you will find all the code needed to run AngularJS and include Angular code.

## Schematic

**downgrade-module** _&lt;name&gt; &lt;options ...&gt;_

### Required

- **name** (`string`)  
  The name of the main AngularJS module.

### Options

- **app** (`string`)  
  The name of the application to add it to.
- **angularJsImport** (`string`)  
  Import expression of the AngularJS application (e.g., --angularJsImport=node_modules/my_app).
- **skipPackageJson** (`boolean`)  
  Do not add @angular/upgrade to package.json (e.g., --skipPackageJson). Default is `false`.

## After Downgrade Module

Nx sets up the downgrade module for you to help you get started with your conversion process to Angular. Check out the blog post on [Using Nrwl/Nx to Upgrade You AngularJS Applications to Angular](https://blog.nrwl.io/using-nrwl-nx-to-upgrade-you-angularjs-applications-to-angular-f5b8adf188aa) to learn more about the differences between Upgrade and Downgrade Module.

From there, a good next step is to pick a slicing strategy for taking on incremental upgrades. To learn about the vertical and horizontal slicing strategies check out [Two Approaches to Upgrading Angular Applications](https://blog.nrwl.io/two-approaches-to-upgrading-angular-apps-6350b33384e3).

### Upgrading/Downgrading Injectables and Components

Once you have decided on a slicing strategy you will move forward with converting AngularJS components (directives) and injectables to Angular and downgrading them to use them in the AngularJS bits as well as upgrading some of the AngularJS bits to be able to run in the Angular ones. The blog post [NgUpgrade in Depth](https://blog.nrwl.io/ngupgrade-in-depth-436a52298a00) includes information on handling injectable and component conversions to Angular, which are the same way to do it for the Downgrade Module approach. Take a look at the sections on **Dependency Injection** and **Component Integration** to learn how to upgrade/downgrade injectables and components for use in AngularJS and Angular.

### Controlling Change Detection

The other piece of the puzzle that you will need to handle is manually triggering change detection if your component tree consists of a combination of AngularJS and Angular components.

If you have an Angular component that has an AngularJS child component you may need to inject in `$rootScope` and call `$digest` after your Angular component does something to get the child AngularJS component to update:

```typescript
@Component({
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.css']
})
export class TicketListComponent implements OnInit {
  @Input() tuskTickets;
  notifyList = [];

  constructor(@Inject('$rootScope') private rootScope: any) {}

  onNotifyAll() {
    this.notifyList = this.tuskTickets.map(function(t) {
      return t.id;
    });
    // we need to force digest to trigger angularjs change detection
    this.rootScope.$digest();
  }
}
```

Since the two change detection systems are kept separate in the Downgrade Module approach, you have to handle telling the other to run if the one you are in needs to affect the other.
