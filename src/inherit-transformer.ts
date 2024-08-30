import {
	InvalidDirectiveError,
	TransformerPluginBase,
} from "@aws-amplify/graphql-transformer-core";
import {
	TransformerContextProvider,
	TransformerSchemaVisitStepContextProvider,
} from "@aws-amplify/graphql-transformer-interfaces";
import {
	DirectiveNode,
	ObjectTypeDefinitionNode,
	isTypeDefinitionNode,
	DocumentNode,
} from "graphql";

export class InheritTransformer extends TransformerPluginBase {
	constructor() {
		super("InheritTransformer", "directive @inherit(from: [String]!) on OBJECT | INTERFACE");
	}

	public object = (
		definition: ObjectTypeDefinitionNode,
		directive: DirectiveNode,
		acc: TransformerSchemaVisitStepContextProvider
	) => {
		// Extract the names of the types to inherit from
		const objectName = definition.name.value;
		const directiveName = directive.name.value;
		if (directiveName !== 'inherit') {
			return;
		}
		const directiveArguments = directive.arguments;
		const inheritFrom = [];
		if (Array.isArray(directiveArguments) && directiveArguments.length > 0) {
			for (const directiveArgument of directiveArguments) {
				const argumentName = directiveArgument.name.value;
				const argumentValue = directiveArgument.value;
				const argumentValueKind = argumentValue.kind;
				if (argumentName === "from") {
					if (argumentValueKind === "ListValue") {
						const values = argumentValue.values;
						for (const value of values) {
							if (value.kind !== "StringValue") {
								throw new InvalidDirectiveError(
									"Directive " + directiveName + " on " + objectName + " has an invalid type for from value(s): " + value.kind
								);
							}
							inheritFrom.push(value.value);
						}
					} 
					else if (argumentValueKind === "StringValue") {
						inheritFrom.push(argumentValue.value);
					}
					else {
						throw new InvalidDirectiveError(
							"Directive " + directiveName + " on " + objectName + " has an invalid type for from value(s): " + argumentValueKind
						);
					}
				}
				else {
					throw new InvalidDirectiveError(
						"Directive " + directiveName + " on " + objectName + " has an invalid argument: " + argumentName
					);
				}
			}
		}
		else {
			throw new InvalidDirectiveError(
				"Directive '@inherit' on " + objectName + " must specify a 'from' argument"
			);
		}

		interface IDefinitions {
			[key: string]: ObjectTypeDefinitionNode;
		}

		// Create a map of the definitions
		const definitionsArray = acc.inputDocument.definitions;
		const definitions:IDefinitions = {};
		for (const definition of definitionsArray) {
			if (definition.kind === "ObjectTypeDefinition") {
				const definitionName = definition.name.value;
				definitions[definitionName] = definition;
			}
		}

		const updatedDefinitionFields = [...definition.fields || []];
		// Add the fields from the inherited types to the current type
		for (const inheritedType of inheritFrom) {
			const inheritedDefinition = definitions[inheritedType];
			if (!inheritedDefinition) {
				throw new InvalidDirectiveError(
					"Type " + inheritedType + " specified in '@inherit' directive on " + objectName + " does not exist."
				);
			}
			const inheritedFields = inheritedDefinition.fields || [];
			for (const inheritedField of inheritedFields) {
				const inheritedFieldName = inheritedField.name.value;
				let fieldExists = false;
				for (const updatedDefinitionField of updatedDefinitionFields) {
					if (updatedDefinitionField.name.value === inheritedFieldName) {
						fieldExists = true;
						break;
					}
				}
				if (!fieldExists) {
					updatedDefinitionFields.push(inheritedField);
				}
			}
		}

		const updatedDefinition = {
			...definition,
			fields: updatedDefinitionFields
		};

		acc.output.updateObject(updatedDefinition);
	};
}