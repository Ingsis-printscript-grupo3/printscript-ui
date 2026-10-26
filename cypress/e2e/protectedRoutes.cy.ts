import {AUTH0_USERNAME, AUTH0_PASSWORD} from "../../src/utils/constants";

const isAuth0Configured = Boolean(
  (Cypress.env('auth0_domain') || Cypress.env('AUTH0_DOMAIN') || Cypress.env('VITE_AUTH0_DOMAIN')) &&
  AUTH0_USERNAME &&
  AUTH0_PASSWORD
);

const describeOrSkip = isAuth0Configured ? describe : describe.skip;

describeOrSkip('Protected routes test', () => {
  beforeEach(function () {
    if (!isAuth0Configured) {
      this.skip();
    }
  });

  it('should redirect to login when accessing a protected route unauthenticated', function () {
    if (!isAuth0Configured) {
      this.skip();
    }
    // Visit the protected route
    cy.visit('/');

    cy.wait(1000);

    // Check if the URL is redirected to the login page
    cy.url().should('include', '/login');
  });

  it('should display login content', function () {
    if (!isAuth0Configured) {
      this.skip();
    }
    // Visit the login page
    cy.visit('/login');

    // Look for text that is likely to appear on a login page
    cy.contains('Log in').should('exist');
    cy.contains('Password').should('exist'); // Adjust the text based on actual content
  });

  it('should not redirect to login when the user is already authenticated', function () {
    if (!isAuth0Configured) {
      this.skip();
    }
    cy.loginToAuth0(
        AUTH0_USERNAME,
        AUTH0_PASSWORD
    );

    cy.visit('/');

    cy.wait(1000);

    // Check if the URL is redirected to the login page
    cy.url().should('not.include', '/login');
  });
});
