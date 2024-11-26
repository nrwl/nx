import { Component } from 'react';

/**
 * From https://www.npmjs.com/package/react-hubspot-form
 */

let globalId = 0;

declare const window: {
  hbspt: any;
};

interface HubspotFormProps {
  region?: string;
  portalId?: string;
  formId?: string;
  noScript?: boolean;
  loading?: any;
  onSubmit?: (formData) => void;
  onReady?: (form) => void;
}

export class HubspotForm extends Component<
  HubspotFormProps,
  { loaded: boolean }
> {
  id: number;
  el?: HTMLDivElement | null = null;

  constructor(props) {
    super(props);
    this.state = {
      loaded: false,
    };
    this.id = globalId++;
    this.createForm = this.createForm.bind(this);
    this.findFormElement = this.findFormElement.bind(this);
  }

  createForm(): void {
    if (typeof window === 'undefined') return;

    if (window.hbspt) {
      // protect against component unmounting before window.hbspt is available
      if (this.el === null) {
        return;
      }

      const props: HubspotFormProps = {
        ...this.props,
      };
      delete props.loading;
      delete props.noScript;
      delete props.onSubmit;
      delete props.onReady;

      const options = {
        ...props,
        target: `#${this.el?.getAttribute(`id`)}`,
        onFormSubmit: ($form) => {
          // ref: https://developers.hubspot.com/docs/methods/forms/advanced_form_options
          const formData = $form.serializeArray();
          if (this.props.onSubmit) {
            this.props.onSubmit(formData);
          }
        },
      };
      window.hbspt.forms.create(options);
    } else {
      setTimeout(this.createForm, 1);
    }
  }

  loadScript() {
    const script = document.createElement(`script`);
    script.defer = true;
    script.onload = () => {
      this.createForm();
      this.findFormElement();
    };
    script.src = `//js.hsforms.net/forms/v2.js`;
    document.head.appendChild(script);
  }

  findFormElement() {
    // protect against component unmounting before form is added
    if (this.el === null) {
      return;
    }
    const form = this.el?.querySelector(`iframe`);
    if (form) {
      this.setState({ loaded: true });
      if (this.props.onReady) {
        this.props.onReady(form);
      }
    } else {
      setTimeout(this.findFormElement, 1);
    }
  }

  override componentDidMount() {
    if (!window.hbspt && !this.props.noScript) {
      this.loadScript();
    } else {
      this.createForm();
      this.findFormElement();
    }
  }

  override render() {
    return (
      <>
        <div
          ref={(el) => (this.el = el)}
          id={`reactHubspotForm${this.id}`}
          style={{ display: this.state.loaded ? 'block' : 'none' }}
        />
        {!this.state.loaded && this.props.loading}
      </>
    );
  }
}
