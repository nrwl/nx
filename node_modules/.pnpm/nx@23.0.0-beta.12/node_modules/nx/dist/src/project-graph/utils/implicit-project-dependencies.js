"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyImplicitDependencies = applyImplicitDependencies;
function applyImplicitDependencies(projects, builder) {
    Object.keys(projects).forEach((source) => {
        const p = projects[source];
        if (p.implicitDependencies && p.implicitDependencies.length > 0) {
            p.implicitDependencies.forEach((target) => {
                if (target.startsWith('!')) {
                    builder.removeDependency(source, target.slice(1));
                }
                else {
                    builder.addImplicitDependency(source, target);
                }
            });
        }
    });
}
