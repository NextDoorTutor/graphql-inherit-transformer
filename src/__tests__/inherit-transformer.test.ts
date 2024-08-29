import { GraphQLTransform } from "@aws-amplify/graphql-transformer-core";
import { ModelTransformer } from "@aws-amplify/graphql-model-transformer";
import { ModelResourceIDs } from "graphql-transformer-common";
import InheritTransformer from "../index";

test("@inherit directive can be used on types", () => {
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
	expect(() => transformer.transform(schema)).not.toThrow();
});

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

		type UserModel @inherit(badArgument: [3]) {
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

		type UserModel @inherit(badArgument: 3) {
			name: String!
		}
	`;
	const transformer = new GraphQLTransform({
		transformers: [new ModelTransformer(), new InheritTransformer()],
	});
	expect(() => transformer.transform(schema)).toThrowError();
});