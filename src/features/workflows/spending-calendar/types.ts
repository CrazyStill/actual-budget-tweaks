export interface DayTransaction {
	payee: string;
	amount: number;
	categoryName: string;
	categoryId: string;
	accountName: string;
	notes: string;
	/** A scheduled occurrence that hasn't happened yet. */
	upcoming?: boolean;
	/** A scheduled occurrence whose date has passed with no matching transaction. */
	missed?: boolean;
}
