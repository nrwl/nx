---
type: lesson
title: Welcome to TutorialKit
focus: /counter.js
---

# Welcome to TutorialKit

Hey there, and welcome to TutorialKit 👋!

To kick things off, we have prepared a small demo lesson for you, where we'll dive into the concept of event handling in JavaScript. Our task is to resuscitate a lifeless counter app by introducing the crucial element of interactivity: **event listeners**.

Let's look at the preview on the right for a moment and try to click on the button that says `counter is 0`. We'll notice that it doesn't work.

In the code for `counter.js`, which you can find on the right, we have a `setupCounter` function responsible for initializing our counter app. However, a crucial component is missing: an event listener for the button.

Event listeners are essential in web development as they enable our applications to respond to user actions. In this case, we need to listen for clicks on the button to increment the counter.

To address this, we'll call the `addEventListener` to attach a `click` event listener to the button element. When a click is detected, we'll execute a callback function that increments the counter and updates the `innerHTML` accordingly.

```ts add={9}
export function setupCounter(element) {
  let counter = 0;

  const setCounter = (count) => {
    counter = count;
    element.innerHTML = `count is ${counter}`;
  };

  element.addEventListener('click', () => setCounter(counter + 1));

  setCounter(0);
}
```

This gives you a sneak peak of the TutorialKit experience, demonstrating what it's capable of.

Happy writing!
