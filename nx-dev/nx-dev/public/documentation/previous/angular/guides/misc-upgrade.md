# Upgrading AngularJS Applications

There are two main ways to incrementally upgrade your AngularJS application: using UpgradeModule and using downgradeModule. Nx helps you use both.

## Using UpgradeModule

NgUpgrade is a library put together by the Angular team, which we can use in our application to mix and match AngularJS and Angular components and bridge the AngularJS and Angular dependency injection systems. We can call such an application a “hybrid application”, and the code required to bootstrap it an "upgrade module".

Setting up an Upgrade Module manually involves several steps and is easy to misconfigure. **Nx** provides a command that does it for you.

```console
ng g @nrwl/angular:upgrade-module legacyApp --project=myapp
```

This will add and set up `UpgradeModule`, configure `legacyApp`, and will add all the needed dependencies to `package.json`.

Open the generated `legacy-app-setup.ts` and you will find all the code needed to bridge the AngularJS and Angular applications.

### Testing Hybrid Applications

For a lot of applications, just running one command is sufficient to convert your application into a hybrid application. That's not always the case--sometimes changes are required. To make this iterative process easier, Nx creates `hybrid.spec.ts`, which you can use to make sure the upgrade module works.

### After Upgrade Module

Nx sets up the upgrade module for you to help you get started with your upgrade process. To learn more on how to upgrade your application, once an upgrade module is set up, check out the following resources:

#### Talk: Upgrading Enterprise Angular Applications

In this talk at NgConf, Victor Savkin shows how to upgrade your application gradually, component by component, module by module using NgUpgrade and the Angular Router. He discusses the common problems developers face during such migrations and the patterns that can be used to remedy them.

[![Upgrading Enterprise Angular Applications - Victor Savkin](https://img.youtube.com/vi/izpqQpD8RQ0/0.jpg)](https://www.youtube.com/watch?v=izpqQpD8RQ0 'Upgrading Enterprise Angular Applications - Victor Savkin')

#### Blog: Upgrading Angular Applications

In this blog post series Victor Savkin covers similar topics but more in depth. He dives deep into NgUpgrade, including the mental model, implementation, subtleties of the API. Then he talks about different strategies for upgrading large AngularJS applications.

- [NgUpgrade in Depth](https://blog.nrwl.io/ngupgrade-in-depth-436a52298a00)
- [Upgrade Shell](https://blog.nrwl.io/upgrading-angular-applications-upgrade-shell-4d4f4a7e7f7b)
- [Two Approaches to Upgrading Angular Applications](https://blog.nrwl.io/two-approaches-to-upgrading-angular-apps-6350b33384e3)
- [Managing Routers and URL](https://blog.nrwl.io/upgrading-angular-applications-managing-routers-and-url-ca5588290aaa)
- [Using NgUpgrade like a Pro: Lazy Loading AngularJS Applications](https://blog.nrwl.io/using-ngupgrade-like-a-pro-lazy-loading-angularjs-applications-469819f5c86)

## Using downgradeModule

While NgUpgrade provides a way to run Angular and AngularJS code side by side and bridge the dependency injection systems, it does take a bit of a performance hit. Reason being, you end up having both change detection systems running at the same time regardless of if you are hitting Angular or AngularJS code.

The Angular upgrade package provides a way to do "NgUpgrade Lite", which is the concept of running AngularJS and downgrading Angular to run when needed, as well as keeping the change detection systems separate. Angular change detection will only run on Angular code and AngularJS scope digest will only run on AngularJS code.

For finer grain control over application performance during conversion to Angular, the downgrade module approach is a good choice.

Setting up a Downgrade Module manually involves several steps and is easy to misconfigure. **Nx** provides a command that does it for you.

```console
ng @nrwl/angular:downgrade-module legacyApp --project=myapp
```

This will configure the `AppModule` to not bootstrap the `AppComponent` and instead set it up as an entry component. It will also configure `main.ts` to bootstrap AngularJS and use the `downgradeModule` to downgrade the Angular `AppModule` to run in AngularJS.

Open `main.ts` and you will find all the code needed to run AngularJS and include Angular code.

### After Downgrade Module

Nx sets up the downgrade module for you to help you get started with your conversion process to Angular. Check out the blog post on [Using Nrwl/Nx to Upgrade You AngularJS Applications to Angular](https://blog.nrwl.io/using-nrwl-nx-to-upgrade-you-angularjs-applications-to-angular-f5b8adf188aa) to learn more about the differences between Upgrade and Downgrade Module.

From there, a good next step is to pick a slicing strategy for taking on incremental upgrades. To learn about the vertical and horizontal slicing strategies check out [Two Approaches to Upgrading Angular Applications](https://blog.nrwl.io/two-approaches-to-upgrading-angular-apps-6350b33384e3).

#### Upgrading/Downgrading Injectables and Components

Once you have decided on a slicing strategy you will move forward with converting AngularJS components (directives) and injectables to Angular and downgrading them to use them in the AngularJS bits as well as upgrading some of the AngularJS bits to be able to run in the Angular ones. The blog post [NgUpgrade in Depth](https://blog.nrwl.io/ngupgrade-in-depth-436a52298a00) includes information on handling injectable and component conversions to Angular, which are the same way to do it for the Downgrade Module approach. Take a look at the sections on **Dependency Injection** and **Component Integration** to learn how to upgrade/downgrade injectables and components for use in AngularJS and Angular.

#### Controlling Change Detection

The other piece of the puzzle that you will need to handle is manually triggering change detection if your component tree consists of a combination of AngularJS and Angular components.

If you have an Angular component that has an AngularJS child component you may need to inject in `$rootScope` and call `$digest` after your Angular component does something to get the child AngularJS component to update:

```typescript
@Component({
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.css'],
})
export class TicketListComponent implements OnInit {
  @Input() tuskTickets;
  notifyList = [];

  constructor(@Inject('$rootScope') private rootScope: any) {}

  onNotifyAll() {
    this.notifyList = this.tuskTickets.map(function (t) {
      return t.id;
    });
    // we need to force digest to trigger angularjs change detection
    this.rootScope.$digest();
  }
}
```

Since the two change detection systems are kept separate in the Downgrade Module approach, you have to handle telling the other to run if the one you are in needs to affect the other.
