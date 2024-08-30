This is a custom GraphQL transformer for using with AWS AppSync and Amplify. 

It allows you to add inheritance to types such that they can inherit all attributes from a parent type without the need for repetition of attributes

# graphql-inherit-transformer

[![Pull requests are welcome!](https://img.shields.io/badge/PRs-welcome-brightgreen)](#contribute-)
[![npm](https://img.shields.io/npm/v/graphql-inherit-transformer)](https://www.npmjs.com/package/graphql-inherit-transformer)
[![GitHub license](https://img.shields.io/github/license/NextDoorTutor/graphql-inherit-transformer)](https://github.com/NextDoorTutor/graphql-inherit-transformer/blob/main/LICENSE)

## Installation

`npm install --save graphql-inherit-transformer`

## How to use

### Setup custom transformer

Edit `amplify/backend/api/<YOUR_API>/transform.conf.json` and append `"graphql-inherit-transformer"` to the `transformers` field.

```json
"transformers": [
	"graphql-inherit-transformer"
]
```

### Use @inherit directive

Add the `@inherit(from: ["type1", "type2"])` directive to target types:

```graphql
type Model {
	id: ID!
	createdAt: AWSTimestamp!
}

type UserModel @inherit(from: ["Model"]) {
	name: String!
}
```

After transformation results in:

```graphql
type Model {
	id: ID!
	createdAt: AWSTimestamp!
}

type UserModel {
	name: String!
	id: ID!
	createdAt: AWSTimestamp!
}
```

## License

The [MIT License](LICENSE)

## Credits
Created by James at [Next Door Tutor Ltd](https://nextdoortutor.co.uk)

Used the graphql-ttl-transformer package by [Florian Gyger Software](https://floriangyger.ch) as an example template to get started as I had no experience of custom graphQL transformers and had previously used this package.
