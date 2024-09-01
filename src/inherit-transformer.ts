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
	InputValueDefinitionNode,
	TypeNode,
} from "graphql";

export class InheritTransformer extends TransformerPluginBase {
	constructor() {
		super(
			"InheritTransformer", 
			"directive @inherit(from: [String!]!, removeNonNull: [String]) on OBJECT|INPUT_OBJECT"
		);
	}

	public object = function (definition: ObjectTypeDefinitionNode, directive: DirectiveNode, acc: TransformerSchemaVisitStepContextProvider) {
		transformDefinition(definition, directive, acc, false);
	};

	public input = function (definition: InputObjectTypeDefinitionNode, directive: DirectiveNode, acc: TransformerSchemaVisitStepContextProvider) {
		transformDefinition(definition, directive, acc, false);
	};

	public transformSchema = function (acc: TransformerSchemaVisitStepContextProvider) {
		const updateObject = function (object:ObjectTypeDefinitionNode, logging = true) {
			if (!object) {
				return;
			}
			const objectName = object.name.value;

			//Iterate over all the fields in the object and convert all arguments to inputs that are not already inputs
			const fields = object.fields || [];
			const updatedFields = [];
			let fieldUpdate = false;
			for (const field of fields) {
				const fieldName = field.name.value;
				//Iterate over all the arguments in the field and convert them to inputs if they are not already inputs
				const fieldArguments = field.arguments || [];
				const updatedFieldArguments:InputValueDefinitionNode[] = [];
				let argumentUpdate = false;
				for (const fieldArgument of fieldArguments) {
					//Get the argument object to check
					const argumentName = fieldArgument.name.value;
					let argumentType = fieldArgument.type;
					const typeStack:TypeNode[] = [];
					while (argumentType.kind !== "NamedType") {
						argumentType = argumentType.type;
						typeStack.push(argumentType);
					}
					const argumentTypeName = argumentType.name.value;
					const argumentObject = acc.output.getType(argumentTypeName);
					if (!argumentObject) {
						throw new InvalidDirectiveError(
							"Type: '" + argumentTypeName + "' on " + objectName + "." + fieldName + "." + argumentName + " does not exist."
						);
					}
					//Check if the argument is already an input
					const argumentKind = argumentObject.kind;
					if (argumentKind !== "InputObjectTypeDefinition") {
						//If not an input, check it can be converted to an input
						if (argumentKind !== "InterfaceTypeDefinition" && argumentKind !== "ObjectTypeDefinition") {
							throw new InvalidDirectiveError(
								"Type: '" + argumentTypeName + "' on " + objectName + "." + fieldName + "." + argumentName + " is not a valid type."
							);
						}
						//Check if an input with the same name already exists
						const newInputName = argumentTypeName + "Input";
						const existingInput = acc.output.getType(newInputName);
						//If an input with the same name does not exist, create a new input
						if (existingInput === undefined) {
							const newInput = {
								...argumentObject,
								kind: "InputObjectTypeDefinition",
								name: {
									...argumentObject.name,
									value: newInputName
								}
							} as InputObjectTypeDefinitionNode;
							acc.output.addInput(newInput);
							logging && console.log("Added input: ", newInputName);
						}
						else if (existingInput.kind !== "InputObjectTypeDefinition") {
							//If an input with the same name exists but is not an input, throw an error
							throw new InvalidDirectiveError(
								"Type: '" + newInputName + "' is not an input type."
							);
						}

						let newType = {
							kind: "NamedType",
							name: {
								kind: "Name",
								value: newInputName
							}
						} as TypeNode;

						while (typeStack.length > 0	) {
							const type = typeStack.pop();
							newType = {
								...type,
								type: newType

							} as TypeNode;
						}
						
						// Create a new argument with the input type
						let newInputValue = {
							...fieldArgument,
							kind: "InputValueDefinition",
							type: newType
						} as InputValueDefinitionNode;
						
						
						// //Add the new argument to the updated field arguments
						updatedFieldArguments.push(newInputValue);
						argumentUpdate = true;
					}
					else {
						//If the argument is already an input, add it to the updated field arguments
						updatedFieldArguments.push(fieldArgument);
					}
				}
				//If there was an update, update the field with the updated arguments
				if (argumentUpdate) {
					const updatedField = {
						...field,
						arguments: updatedFieldArguments
					} as FieldDefinitionNode;
					updatedFields.push(updatedField);
				}
				else {
					updatedFields.push(field);
				}
			}
			//If there was an update, update the object with the updated fields
			if (fieldUpdate) {
				const updatedObject = {
					...object,
					fields: updatedFields
				} as ObjectTypeDefinitionNode;
				acc.output.updateObject(updatedObject);
			}
		}

		const query = acc.output.getQuery();
		if (query) {
			updateObject(query);
		}
		const mutation = acc.output.getMutation();
		if (mutation) {
			updateObject(mutation);
		}
		const subscription = acc.output.getSubscription();
		if (subscription) {
			updateObject(subscription);
		}

		console.log(JSON.stringify(acc.output));
	}
}

const transformDefinition = function (definition: ObjectTypeDefinitionNode|InputObjectTypeDefinitionNode, directive: DirectiveNode, acc: TransformerSchemaVisitStepContextProvider, logging: boolean = false) {
	// Extract the names of the types to inherit from
	const objectName = definition.name.value;
	const definitionKind = definition.kind;
	logging && console.log("Name: ", objectName);
	const directiveName = directive.name.value;
	if (directiveName !== 'inherit') {
		return;
	}

	//Returns an array of type names that the given directive inherits from
	interface IInheritDirectiveDetails {
		inheritFrom: string[]
		removeNonNull: string[]
	};

	const getInheritDirectiveDetails = function (directive: DirectiveNode, parentName: string):IInheritDirectiveDetails {
		const directiveName = directive.name.value;
		if (directiveName !== 'inherit') {
			return {
				inheritFrom: [],
				removeNonNull: []
			};
		}
		const directiveArguments = directive.arguments;
		const inheritFrom:string[] = [];
		const removeNonNull:string[] = [];
		if (Array.isArray(directiveArguments) && directiveArguments.length > 0) {
			for (const directiveArgument of directiveArguments) {
				const argumentName = directiveArgument.name.value;
				const argumentValue = directiveArgument.value;
				const argumentValueKind = argumentValue.kind;
				if (argumentName === "from" || argumentName === "removeNonNull") {
					if (argumentValueKind === "ListValue") {
						const values = argumentValue.values;
						for (const value of values) {
							if (value.kind !== "StringValue") {
								throw new InvalidDirectiveError(
									"Directive " + directiveName + " on " + parentName + " has an invalid type for " + argumentName + " value(s): " + value.kind
								);
							}
							if (argumentName === "from") {
								inheritFrom.push(value.value);
							}
							else {
								removeNonNull.push(value.value);
							}
						}
					} 
					else if (argumentValueKind === "StringValue") {
						if (argumentName === "from") {
							inheritFrom.push(argumentValue.value);
						}
						else {
							removeNonNull.push(argumentValue.value);
						}
					}
					else {
						throw new InvalidDirectiveError(
							"Directive " + directiveName + " on " + parentName + " has an invalid type for " + argumentName + " value(s): " + argumentValueKind
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
		return {
			inheritFrom: inheritFrom,
			removeNonNull: removeNonNull
		};
	};

	//Build a map of the fields in the current type including inherited fields
	interface ITransformedDefinitionFields {
		[key: string]: FieldDefinitionNode|InputValueDefinitionNode;
	}
	const transformedDefinitionFields:ITransformedDefinitionFields = {};
	const fields = definition.fields || [];
	//Start with the fields in the current type already
	for (const field of fields) {
		let fieldKind = "FieldDefinition"
		if (definitionKind === "InputObjectTypeDefinition") {
			fieldKind = "InputValueDefinition";
		}
		const newField = {
			...field,
			kind: fieldKind
		} as FieldDefinitionNode|InputValueDefinitionNode;

		transformedDefinitionFields[field.name.value] = newField;
	}

	//Get the names of the types to inherit from
	const inheritDirectiveDetails = getInheritDirectiveDetails(directive, objectName);
	const inheritedTypeNames = inheritDirectiveDetails.inheritFrom || [];
	const removeNonNull = inheritDirectiveDetails.removeNonNull || [];
	logging && console.log("Directly inherited types:");
	logging && console.log(inheritedTypeNames);

	//Get the fields from the inherited types
	const getTransformedDefinitionFields = function (definitionName:string, removeNonNullable:boolean = false) {
		const givenDefinition = acc.output.getType(definitionName);
		if (!givenDefinition) {
			throw new InvalidDirectiveError(
				"Type '" + definitionName + "' specified in '@inherit' directive does not exist."
			);
		}
		if (givenDefinition.kind !== "ObjectTypeDefinition" && givenDefinition.kind !== "InputObjectTypeDefinition") {
			throw new InvalidDirectiveError(
				"Type '" + definitionName + "' specified in '@inherit' directive is not a valid type."
			);
		}

		const definitionFields = [...givenDefinition.fields || []];
		for (let definitionField of definitionFields) {
			if (removeNonNullable) {
				const fieldType = definitionField.type;
				if (fieldType.kind === "NonNullType") {
					definitionField = {
						...definitionField,
						type: fieldType.type
					}
				}
			}

			let fieldKind = "FieldDefinition"
			if (definitionKind === "InputObjectTypeDefinition") {
				fieldKind = "InputValueDefinition";
			}
			const newDefinitionField = {
				...definitionField,
				kind: fieldKind
			} as FieldDefinitionNode|InputValueDefinitionNode;
			transformedDefinitionFields[definitionField.name.value] = newDefinitionField;
		}
		const definitionDirectives = givenDefinition.directives || [];
		for (const definitionDirective of definitionDirectives) {
			const inheritDirectiveDetails = getInheritDirectiveDetails(definitionDirective, definitionName);
			const inheritedTypeNames = inheritDirectiveDetails.inheritFrom || [];
			const removeNonNull = inheritDirectiveDetails.removeNonNull || [];
			for (const inheritedTypeName of inheritedTypeNames) {
				let inheritedRemoveNonNull = false || removeNonNullable;
				if (!inheritedRemoveNonNull && removeNonNull.includes(inheritedTypeName)) {
					inheritedRemoveNonNull = true;
				}
				getTransformedDefinitionFields(inheritedTypeName, inheritedRemoveNonNull);
			}
		}
	};

	for (const inheritedTypeName of inheritedTypeNames) {
		let removeNonNullable = false;
		if (removeNonNull.includes(inheritedTypeName)) {
			removeNonNullable = true;
		}
		getTransformedDefinitionFields(inheritedTypeName, removeNonNullable);
	}

	const updatedDefinitionFields = [];
	for (const field of Object.values(transformedDefinitionFields)) {
		updatedDefinitionFields.push(field);
	}

	logging && console.log("All inherited fields:");
	logging && console.log(Object.keys(transformedDefinitionFields));

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

	//logging && console.log(JSON.stringify(acc.output));
};