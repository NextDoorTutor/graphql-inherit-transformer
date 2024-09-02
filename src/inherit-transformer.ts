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
	buildASTSchema,
	print,
	DocumentNode
} from "graphql";

const fs = require("fs");
const path = require("path");

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
		const updateOperation = function (operation:ObjectTypeDefinitionNode, logging = false) {
			if (!operation) {
				return;
			}
			const operationName = operation.name.value;
			const awsScalarTypes = ["AWSDate", "AWSTime", "AWSDateTime", "AWSTimestamp", "AWSEmail", "AWSJSON", "AWSPhone", "AWSURL", "AWSIPAddress"];
			const scalarTypes = [...awsScalarTypes, "String", "ID", "Int", "Float", "Boolean"];

			let fieldName = "";
			let argumentName = "";
			let update = false;
			const getInputTypeNode = function (inputTypeNode:TypeNode, parentNameStack:string[] = [], parentTypeStack:string[] = []):TypeNode {
				// console.log(parentStack);
				const typeStack:TypeNode[] = [];
				let typeNode = inputTypeNode
				while (typeNode.kind !== "NamedType") {
					typeStack.push(typeNode);
					typeNode = typeNode.type;
				}

				let name = "";
				for (const parent of parentNameStack) {
					if (name != "") {
						name = name + ".";
					}
					name = name + parent;
				}
				const typeName = typeNode.name.value;
				
				parentTypeStack = [...parentTypeStack, typeName];
				let type = "";
				for (const parent of parentTypeStack) {
					if (type != "") {
						type = type + ".";
					}
					type = type + parent;
				}
				// console.log("Input: " + name + " : " + type);
				// console.log(inputTypeNode);
				
				if (scalarTypes.includes(typeName)) {
					return inputTypeNode;
				}
				const typeObject = acc.output.getType(typeName);

				if (!typeObject) {
					throw new InvalidDirectiveError(
						"Type: '" + typeName + "' on " + operationName + "." + fieldName + "." + argumentName + " does not exist."
					);
				}
				//Check if the argument is already an input
				const typeKind = typeObject.kind;
				if (typeKind === "SchemaDefinition" || typeKind === "DirectiveDefinition" || typeKind === "UnionTypeDefinition") {
					throw new InvalidDirectiveError(
						"Type: '" + typeName + "' within " + operationName + "." + fieldName + "." + argumentName + " is not a valid type."
					);
				}
				if (typeKind === "EnumTypeDefinition" || typeKind === "ScalarTypeDefinition") {
					return inputTypeNode;
				}

				const pretendGenerateType = function (typeNode:NamedTypeNode):TypeNode {
					const typeName = typeNode.name.value;
					if (scalarTypes.includes(typeName)) {
						return typeNode;
					}
					const typeObject = acc.output.getType(typeName);
					if (!typeObject) {
						throw new InvalidDirectiveError(
							"Type: '" + typeName + "' on " + operationName + "." + fieldName + "." + argumentName + " does not exist."
						);
					}
					const typeKind = typeObject.kind;
					let inputName = typeName;
					if (typeKind !== "InputObjectTypeDefinition") {
						inputName = typeName + "Input";
						update = true;
					}

					return {
						kind: "NamedType",
						name: {
							kind: "Name",
							value: inputName
						}
					} as TypeNode;
				};
					

				const typeFields:InputValueDefinitionNode[] = [];
				for (const field of typeObject.fields || []) {
					let fieldType = field.type;
					let primitiveType = fieldType
					while (primitiveType.kind !== "NamedType") {
						primitiveType = primitiveType.type;
					}
					if(parentTypeStack.includes(primitiveType.name.value)) {
						// console.log("Parent stack includes: ", primitiveType.name.value);
						// console.log(parentStack);
						fieldType = pretendGenerateType(primitiveType);
						while (typeStack.length > 0	) {
							const type = typeStack.pop();
							fieldType = {
								...type,
								type: fieldType
		
							} as TypeNode;
						}
					}
					else {
						// parentStack.push(primitiveType.name.value);
						const fieldName = field.name.value;
						const newParentNameStack = [...parentNameStack, fieldName];
						fieldType = getInputTypeNode(field.type, newParentNameStack, parentTypeStack);
					}	

					const inputValueDefinition = {
						kind: "InputValueDefinition",
						name: field.name,
						type: fieldType
					} as InputValueDefinitionNode;
					typeFields.push(inputValueDefinition);
				}

				let inputName = typeName;
				if (typeKind !== "InputObjectTypeDefinition") {
					//Check if an input with the same name already exists
					inputName = typeName + "Input";
					const existingInput = acc.output.getType(inputName);
					//If an input with the same name does not exist, create a new input
					if (existingInput === undefined) {
						const newInput = {
							kind: "InputObjectTypeDefinition",
							name: {
								kind: "Name",
								value: inputName
							},
							fields: typeFields
						} as InputObjectTypeDefinitionNode;
						acc.output.addInput(newInput);
						logging && console.log("Added input: ", inputName);
					}
					else if (existingInput.kind !== "InputObjectTypeDefinition") {
						//If an input with the same name exists but is not an input, throw an error
						throw new InvalidDirectiveError(
							"Type: '" + inputName + "' is not an input type."
						);
					}
				}

				// console.log(inputTypeNode);
				// console.log(typeStack);

				let newType = {
					kind: "NamedType",
					name: {
						kind: "Name",
						value: inputName
					}
				} as TypeNode;

				while (typeStack.length > 0	) {
					const type = typeStack.pop();
					newType = {
						...type,
						type: newType

					} as TypeNode;
				}
				update = true;
				// console.log("Output: " + name + " : " + type);
				// console.log(newType);
				return newType;
			};
			

			//Iterate over all the fields in the object and convert all arguments to inputs that are not already inputs
			const fields = operation.fields || [];
			const updatedFields = [];
			for (const field of fields) {
				fieldName = field.name.value;
				//Iterate over all the arguments in the field and convert them to inputs if they are not already inputs
				const fieldArguments = field.arguments || [];
				const updatedFieldArguments:InputValueDefinitionNode[] = [];
				for (const fieldArgument of fieldArguments) {
					//Get the argument object to check
					argumentName = fieldArgument.name.value;
					const argumentType = getInputTypeNode(fieldArgument.type, [argumentName]);
					const newInputValue = {
						kind: "InputValueDefinition",
						name: fieldArgument.name,
						type: argumentType,
					} as InputValueDefinitionNode;
					updatedFieldArguments.push(newInputValue);
				}

				const updatedField = {
					kind: "FieldDefinition",
					name: field.name,
					type: field.type,
					arguments: updatedFieldArguments,
					directives: field.directives
				} as FieldDefinitionNode;
				updatedFields.push(updatedField);
			}
			//If there was an update, update the object with the updated fields
			if (update) {
				const updatedObject = {
					...operation,
					fields: updatedFields
				} as ObjectTypeDefinitionNode;
				acc.output.updateObject(updatedObject);
			}
		}

		const query = acc.output.getQuery();
		if (query) {
			updateOperation(query);
		}
		const mutation = acc.output.getMutation();
		if (mutation) {
			updateOperation(mutation);
		}
		const subscription = acc.output.getSubscription();
		if (subscription) {
			updateOperation(subscription);
		}
	}

	public after = function (acc: TransformerSchemaVisitStepContextProvider) {
		const saveSchemaOutput = function (outputPath:string) {
			const nodeMap = JSON.parse(JSON.stringify(acc.output)).nodeMap;
			const definitions = [];
			for (const definition of Object.values(nodeMap)) {
				definitions.push(definition);
			}
			const documentNode = {
				kind: "Document",
				definitions: definitions
			} as DocumentNode;
			const schema = print(documentNode);

			const directory = path.dirname(outputPath);
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, {recursive: true});
			}
			fs.writeFileSync(outputPath, schema, "utf8");
		};
		// saveSchemaOutput(path.join(__dirname, "/output/outputSchema.graphql"))
    }
}

const transformDefinition = function (
	definition: ObjectTypeDefinitionNode|InputObjectTypeDefinitionNode, 
	directive: DirectiveNode, acc: TransformerSchemaVisitStepContextProvider, 
	logging: boolean = false
) {
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