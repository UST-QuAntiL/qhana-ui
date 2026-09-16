# Qhana UI

[![GitHub license](https://img.shields.io/github/license/UST-QuAntiL/qhana-ui)](https://github.com/UST-QuAntiL/qhana-ui/blob/main/LICENSE)

User interface for the [QHAna Backend API](https://github.com/UST-QuAntiL/qhana-backend) and the [QHAna Plugin Runner](https://github.com/UST-QuAntiL/qhana-plugin-runner)


This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 12.1.4.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

Then, make sure that the correct Plugin Seed URLs is set on the Settings page. If not manually specify a URL (e.g. `http://localhost:5005` if the plugin runner runs on port `5005`). Also specify the QHAna Backend service by clicking navigating to "All services" in the "Services" card and insert the backend service info (e.g. Service URL `http://localhost:9090` if the backend is running on port `9090`). The Service Identifier must be set to `qhana-backend`.

## Development server in docker container

Build the image with: `docker build -t qhana-ui .`

Run a container with this image and bind it to port 8080 with `docker run -p 8080:8080 qhana-ui` if you want to run the container detached add the flag `-d`.


## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run the unit tests locally with ChromeHeadless:

`npm test -- --watch=false --browsers=ChromeHeadless`

The same command is executed automatically by GitHub Actions for pull requests and pushes to the `main` branch.

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Docker

Build the container with `docker build -t qhana-ui .`

Run the container with `docker run -p 8080:8080 qhana-ui`

### Environment variables for the Docker image

- `QHANA_BACKEND_PROTOCOL`: default protocol for the QHAna backend e.g. `http:`
- `QHANA_BACKEND_HOSTNAME`: default hostname for the QHAna backend e.g. `localhost`
- `QHANA_BACKEND_PORT`: default port for the QHAna backend e.g. `9090`
- `QHANA_BACKEND_PATH`: default path for the QHAna backend e.g. `/path`

They can be added to the run command if you want to change them temporarily e.g. `-e QHANA_BACKEND_PORT=9999` or to the dockerfile if you want to change them permanently e.g. `ENV QHANA_BACKEND_PORT=9999`.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.


## Acknowledgements

Current development is supported by the [Federal Ministry for Economic Affairs and Energy](http://www.bmwi.de/EN) as part of the [PlanQK](https://planqk.de) project (01MK20005N).

## Haftungsausschluss

Dies ist ein Forschungsprototyp.
Die Haftung für entgangenen Gewinn, Produktionsausfall, Betriebsunterbrechung, entgangene Nutzungen, Verlust von Daten und Informationen, Finanzierungsaufwendungen sowie sonstige Vermögens- und Folgeschäden ist, außer in Fällen von grober Fahrlässigkeit, Vorsatz und Personenschäden, ausgeschlossen.

## Disclaimer of Warranty

Unless required by applicable law or agreed to in writing, Licensor provides the Work (and each Contributor provides its Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied, including, without limitation, any warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A PARTICULAR PURPOSE.
You are solely responsible for determining the appropriateness of using or redistributing the Work and assume any risks associated with Your exercise of permissions under this License.