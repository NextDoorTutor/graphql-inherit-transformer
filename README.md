# graphql-inherit-transformer

<!-- [![Pull requests are welcome!](https://img.shields.io/badge/PRs-welcome-brightgreen)](#contribute-) -->
<!-- [![npm](https://img.shields.io/npm/v/graphql-ttl-transformer)](https://www.npmjs.com/package/graphql-ttl-transformer) -->
<!-- [![GitHub license](https://img.shields.io/github/license/flogy/graphql-ttl-transformer)](https://github.com/flogy/graphql-ttl-transformer/blob/main/LICENSE) -->

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

Add `@inherit(from: ["type1", "types"])` to target types:

```graphql
type Model {
	id: ID!
	createdAt: AWSTimestamp!
}

type UserModel @model {
	name: String!
}
```

After transformation results in:

```graphql
type Model {
	id: ID!
	createdAt: AWSTimestamp!
}

type UserModel @model {
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
