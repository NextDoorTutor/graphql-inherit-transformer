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
	InterfaceTypeDefinitionNode,
	InputObjectTypeDefinitionNode,
	UnionTypeDefinitionNode,
	DefinitionNode,
	FieldDefinitionNode,
	NamedTypeNode,
	TypeDefinitionNode,
} from "graphql";

export class InheritTransformer extends TransformerPluginBase {
	constructor() {
		super("InheritTransformer", "directive @inherit(from: [String]!) on OBJECT");
	}

	public object = function (definition: ObjectTypeDefinitionNode, directive: DirectiveNode, acc: TransformerSchemaVisitStepContextProvider) {
		transformDefinition(definition, directive, acc);
	};
}

const transformDefinition = function (definition: ObjectTypeDefinitionNode, directive: DirectiveNode, acc: TransformerSchemaVisitStepContextProvider) {
	// Extract the names of the types to inherit from
	const objectName = definition.name.value;
	console.log("Name: ", objectName);
	const directiveName = directive.name.value;
	if (directiveName !== 'inherit') {
		return;
	}

	//Returns an array of type names that the given directive inherits from
	const getInheritedTypeNames = function (directive: DirectiveNode, parentName: string): string[] {
		const directiveName = directive.name.value;
		if (directiveName !== 'inherit') {
			return [];
		}
		const directiveArguments = directive.arguments;
		const inheritFrom:string[] = [];
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
									"Directive " + directiveName + " on " + parentName + " has an invalid type for from value(s): " + value.kind
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
							"Directive " + directiveName + " on " + parentName + " has an invalid type for from value(s): " + argumentValueKind
						);
					}
				}
				else {
					throw new InvalidDirectiveError(
						"Directive " + directiveName + " on " + parentName + " has an invalid argument: " + argumentName
					);
				}
			}
		}
		else {
			throw new InvalidDirectiveError(
				"Directive '@inherit' on " + parentName + " must specify a 'from' argument"
			);
		}
		return inheritFrom;
	};

	//Build a map of the fields in the current type including inherited fields
	interface ITransformedDefinitionFields {
		[key: string]: FieldDefinitionNode;
	}
	const transformedDefinitionFields:ITransformedDefinitionFields = {};
	const fields = definition.fields || [];
	//Start with the fields in the current type already
	for (const field of fields) {
		transformedDefinitionFields[field.name.value] = field;
	}

	//Get the names of the types to inherit from
	const inheritedTypeNames = getInheritedTypeNames(directive, objectName);
	console.log("Directly inherited types:");
	console.log(inheritedTypeNames);

	//Get the fields from the inherited types
	const getTransformedDefinitionFields = function (definitionName:string) {
		const givenDefinition = acc.output.getObject(definitionName);
		if (!givenDefinition) {
			throw new InvalidDirectiveError(
				"Type " + definitionName + " specified in '@inherit' directive does not exist."
			);
		}
		const definitionFields = [...givenDefinition.fields || []];
		for (const definitionField of definitionFields) {
			transformedDefinitionFields[definitionField.name.value] = definitionField;
		}
		const definitionDirectives = givenDefinition.directives || [];
		for (const definitionDirective of definitionDirectives) {
			const inheritedTypeNames = getInheritedTypeNames(definitionDirective, definitionName);
			for (const inheritedTypeName of inheritedTypeNames) {
				getTransformedDefinitionFields(inheritedTypeName);
			}
		}
	};

	for (const inheritedTypeName of inheritedTypeNames) {
		getTransformedDefinitionFields(inheritedTypeName);
	}

	const updatedDefinitionFields = [];
	for (const field of Object.values(transformedDefinitionFields)) {
		updatedDefinitionFields.push(field);
	}

	console.log("All inherited fields:");
	console.log(Object.keys(transformedDefinitionFields));

	const updatedDefinition = {
		...definition,
		fields: updatedDefinitionFields
	} as ObjectTypeDefinitionNode;
	acc.output.updateObject(updatedDefinition);
	

	// interface IDefinitions {
	// 	[key: string]: ObjectTypeDefinitionNode|InterfaceTypeDefinitionNode|InputObjectTypeDefinitionNode|UnionTypeDefinitionNode;
	// }

	// const isUnionTypeDefinitionNode = function (definition: DefinitionNode): definition is UnionTypeDefinitionNode {
	// 	return definition.kind === "UnionTypeDefinition";
	// }

	// const isValidParentDefinition = function (definition: DefinitionNode): definition is ObjectTypeDefinitionNode|InterfaceTypeDefinitionNode|InputObjectTypeDefinitionNode|UnionTypeDefinitionNode {
	// 	if (!isTypeDefinitionNode(definition)) {
	// 		return false;
	// 	}
	// 	if (definition.kind === "ObjectTypeDefinition") {
	// 		return true;
	// 	}
	// 	if (definition.kind === "InterfaceTypeDefinition") {
	// 		return true;
	// 	}
	// 	if (definition.kind === "InputObjectTypeDefinition") {
	// 		return true;
	// 	}
	// 	if (definition.kind === "UnionTypeDefinition") {
	// 		return true;
	// 	}
	// 	return false;
	// };

	// const unionDefinitions:UnionTypeDefinitionNode[] = [];
	// // Add the fields from the inherited types to the current type
	// for (const inheritedType of inheritFrom) {
	// 	// const inheritedDefinition = definitions[inheritedType];
	// 	const inheritedDefinition = acc.output.getType(inheritedType);
	// 	if (!acc.output.hasType(inheritedType) || !inheritedDefinition) {
	// 		throw new InvalidDirectiveError(
	// 			"Type " + inheritedType + " specified in '@inherit' directive on " + objectName + " does not exist."
	// 		);
	// 	}

	// 	if (!isValidParentDefinition(inheritedDefinition)) {
	// 		throw new InvalidDirectiveError(
	// 			"Type " + inheritedType + " specified in '@inherit' directive on " + objectName + " is not a valid type."
	// 		);
	// 	}
		
	// 	if (isUnionTypeDefinitionNode(inheritedDefinition)) {
	// 		unionDefinitions.push(inheritedDefinition);
	// 	}
	// 	else {
	// 		const inheritedFields = inheritedDefinition.fields || [];
	// 		for (const inheritedField of inheritedFields) {
	// 			const inheritedFieldName = inheritedField.name.value;
	// 			let fieldExists = false;
	// 			for (const updatedDefinitionField of updatedDefinitionFields) {
	// 				if (updatedDefinitionField.name.value === inheritedFieldName) {
	// 					fieldExists = true;
	// 					break;
	// 				}
	// 			}
	// 			if (!fieldExists) {
	// 				if (inheritedField.kind === "InputValueDefinition") {
	// 					const inheritedFieldCopy = {
	// 						...inheritedField,
	// 						kind: "FieldDefinition"
	// 					} as FieldDefinitionNode;
	// 					updatedDefinitionFields.push(inheritedFieldCopy);
	// 				}
	// 				else {
	// 					updatedDefinitionFields.push(inheritedField);
	// 				}
	// 			}
	// 		}
	// 	}
	// }

	// if (unionDefinitions.length == 0) {
	// 	const updatedDefinition = {
	// 		...definition,
	// 		fields: updatedDefinitionFields
	// 	} as ObjectTypeDefinitionNode;

	// 	acc.output.updateObject(updatedDefinition);
	// }
	// else {
	// 	const getTypeDefinitionsFromUnions = function (unionDefinitions: UnionTypeDefinitionNode[]): ObjectTypeDefinitionNode[] {
	// 		const definitionObjects:ObjectTypeDefinitionNode[] = [];
	// 		for (const unionDefinition of unionDefinitions) {
	// 			const unionTypes = unionDefinition.types || [];
	// 			for (const unionType of unionTypes) {
	// 				const unionTypeName = unionType.name.value;
	// 				const unionTypeDefinition = acc.output.getType(unionTypeName);
	// 				if (!unionTypeDefinition) {
	// 					throw new InvalidDirectiveError(
	// 						"Type " + unionTypeName + " specified in union type " + unionDefinition.name.value + " does not exist."
	// 					);
	// 				}
	// 				if (unionTypeDefinition.kind === "UnionTypeDefinition") {
	// 					const unionTypeDefinitionObjects = getTypeDefinitionsFromUnions([unionTypeDefinition]);
	// 					definitionObjects.push(...unionTypeDefinitionObjects);
	// 				}
	// 				else {
	// 					definitionObjects.push(unionTypeDefinition as ObjectTypeDefinitionNode);
	// 				}
	// 			}
	// 		}
	// 		return definitionObjects;
	// 	};
	// 	const unionDefinitionObjects = getTypeDefinitionsFromUnions(unionDefinitions);
	// 	const definitionObjectNames:NamedTypeNode[] = [];
	// 	for (const unionDefinitionObject of unionDefinitionObjects) {
	// 		const definitionObjectName = objectName + "Type" + definitionObjectNames.length
	// 		acc.output.addObject({
	// 			...definition,
	// 			name: {
	// 				...definition.name,
	// 				value: definitionObjectName
	// 			},
	// 			fields: [
	// 				...updatedDefinitionFields,
	// 				...unionDefinitionObject.fields || []
	// 			]
	// 		});
	// 		definitionObjectNames.push({
	// 			kind: "NamedType",
	// 			name: {
	// 				kind: "Name",
	// 				value: definitionObjectName
	// 			}
	// 		});
	// 	}
		
	// 	const updatedDefinition = {
	// 		// ...definition,
	// 		name: {
	// 			...definition.name,
	// 			value: objectName
	// 		}
	// 	} as ObjectTypeDefinitionNode;

	// 	// const updatedDefinition = {
	// 	// 	kind: "UnionTypeDefinition",
	// 	// 	description: definition.description,
	// 	// 	name: definition.name,
	// 	// 	types: definitionObjectNames
	// 	// };
	// 	acc.output.updateObject(updatedDefinition);

	// 	acc.output.addUnion({
	// 		kind: "UnionTypeDefinition",
	// 		description: definition.description,
	// 		name: {
	// 			...definition.name,
	// 			value: objectName
	// 		},
	// 		types: definitionObjectNames
	// 	});
	// }

	console.log(JSON.stringify(acc.output));
};