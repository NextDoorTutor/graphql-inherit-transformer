import { GraphQLTransform } from "@aws-amplify/graphql-transformer-core";
import { ModelTransformer } from "@aws-amplify/graphql-model-transformer";
import { ModelResourceIDs } from "graphql-transformer-common";
import InheritTransformer from "../index";

test("@inherit directive can be used on types and have array of inherit types", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: ["Model"]) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
		//console.log(test);
	}).not.toThrow();
});

test("@inherit directive can be used on inputs and can inherit inputs", () => {
	const schema = `
		input ModelInput {
			id: ID!
			createdAt: AWSDateTime!
		}

		input UserModelInput @inherit(from: ["ModelInput"]) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
		//console.log(test);
	}).not.toThrow();
});

test("@inherit directive can be used on inputs and can inherit types", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		input UserModelInput @inherit(from: ["Model"]) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
	}).not.toThrow();
});

test("@inherit directive can be used on types and can inherit inputs", () => {
	const schema = `
		input ModelInput {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: ["ModelInput"]) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
	}).not.toThrow();
});

test("@inherit directive can be used on types and have a string for inherit type", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: "Model") {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
		//console.log(test);
	}).not.toThrow();
});

test("Can inherit from a type that is also inheriting", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: "Model") {
			name: String!
		}

		type CustomerModel @inherit(from: "UserModel") {
			balance: Float!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
		//console.log(test);
	}).not.toThrow();
});

test("removeNonNull parameter works", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: "Model", removeNonNull: "Model") {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
		console.log(test);
	}).not.toThrow();
});

// test("@inherit directive can be used on types and inherit from a union", () => {
// 	const schema = `
// 		type Model1 {
// 			id: ID!
// 			createdAt: AWSDateTime!
// 		}
// 		type Model2 {
// 			id: ID!
// 			createdAt: AWSDateTime!
// 			updatedAt: AWSDateTime!
// 		}
// 		union ModelUnion = Model1 | Model2

// 		type UserModel @inherit(from: "ModelUnion") {
// 			name: String!
// 		}
// 	`;
// 	const transformer = new GraphQLTransform({
// 		transformers: [new ModelTransformer(), new InheritTransformer()],
// 	});
// 	expect(() => {
// 		const test = transformer.transform(schema);
// 		//console.log(test);
// 	}).not.toThrow();
// });

// test("@inherit directive can be used on types and inherit from a type and a union", () => {
// 	const schema = `
// 		type Model1 {
// 			id: ID!
// 			createdAt: AWSDateTime!
// 		}
// 		type Model2 {
// 			id: ID!
// 			createdAt: AWSDateTime!
// 			updatedAt: AWSDateTime!
// 		}
// 		union ModelUnion = Model1 | Model2

// 		type RegionModel {
// 			region: String!
// 		}

// 		type UserModel @inherit(from: ["RegionModel", "ModelUnion"]) {
// 			name: String!
// 		}
// 	`;
// 	const transformer = new GraphQLTransform({
// 		transformers: [new ModelTransformer(), new InheritTransformer()],
// 	});
// 	expect(() => {
// 		const test = transformer.transform(schema);
// 		//console.log(test);
// 	}).not.toThrow();
// });

test("cannot inherit from undefined type", () => {
	const schema = `
		type UserModel @inherit(from: ["Model"]) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => transformer.transform(schema)).toThrowError();
});

test("must define argument for directive @inherit", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => transformer.transform(schema)).toThrowError();
});

test("must define from for directive @inherit", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(badArgument: ["Model"]) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => transformer.transform(schema)).toThrowError();
});

test("must define string or array of strings for from argument of directive @inherit", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: [3]) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => transformer.transform(schema)).toThrowError();
});

test("must define string or array of strings for from argument of directive @inherit", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: 3) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => transformer.transform(schema)).toThrowError();
});

test("Input already exists", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: ["Model"]) {
			name: String!
		}

		input CreateUserInput {
			name: String!
		}

		type Mutation {
			createUser(userArgument: CreateUserInput!): UserModel
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
		//console.log(test);
	}).not.toThrow();
});

test("Input doesn't exist", () => {
	const schema = `
		type Model {
			id: ID!
			createdAt: AWSDateTime!
		}

		type UserModel @inherit(from: ["Model"]) {
			name: String!
		}

		type Mutation {
			createUser(userArgument: UserModel!): UserModel
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => {
		const test = transformer.transform(schema);
		//console.log(test);
	}).not.toThrow();
});