import {
    Component,
    ElementRef,
    EventEmitter,
    OnInit,
    Output,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import { CurrencyCode, DataService, Option } from '@uplab/admin-ui/core';
import { GlobalProductOptionSelectorComponent } from '@uplab/admin-ui/core';
import { generateAllCombinations } from '@vendure/common/lib/shared-utils';

import { OptionValueInputComponent } from '../option-value-input/option-value-input.component';

const DEFAULT_VARIANT_CODE = '__DEFAULT_VARIANT__';
export type CreateVariantValues = {
    optionValues: string[];
    enabled: boolean;
    sku: string;
    price: number;
    stock: number;
};
export type CreateProductVariantsConfig = {
    groups: Array<{ name: string; values: Array<{ name: string; code?: string }> }>;
    variants: CreateVariantValues[];
};

@Component({
    selector: 'vdr-generate-product-variants',
    templateUrl: './generate-product-variants.component.html',
    styleUrls: ['./generate-product-variants.component.scss'],
})
export class GenerateProductVariantsComponent implements OnInit {
    @Output() variantsChange = new EventEmitter<CreateProductVariantsConfig>();
    @ViewChildren('optionGroupName', { read: ElementRef }) groupNameInputs: QueryList<ElementRef>;
    @ViewChild('optionValueInputComponent') private optionValueInputComponent:
        | OptionValueInputComponent
        | GlobalProductOptionSelectorComponent;
    optionGroups: Array<{
        name: string;
        isGlobal?: boolean;
        globalOptions?: Option[];
        values: Array<{
            name: string;
            code?: string;
            locked: boolean;
        }>;
    }> = [];
    currencyCode: CurrencyCode;
    variants: Array<{ id: string; values: string[] }>;
    variantFormValues: { [id: string]: CreateVariantValues } = {};
    globalOptionGroups: Array<{ name: string; code: string; options: Option[] }>;
    constructor(private dataService: DataService) {}

    ngOnInit() {
        this.dataService.settings.getActiveChannel().single$.subscribe(data => {
            this.currencyCode = data.activeChannel.currencyCode;
        });
        this.dataService.facet.getAllFacets().single$.subscribe(data => {
            this.globalOptionGroups = data.facets.items.map(facet => ({
                code: facet.code,
                name: facet.name,
                options: facet.values.map(value => ({
                    code: value.code,
                    name: value.name,
                    locked: false,
                })),
            }));
        });

        this.generateVariants();
    }

    addOption(index: number, optionName: string, optionCode?: string) {
        const group = this.optionGroups[index];
        if (group) {
            group.values.push({ name: optionName, code: optionCode, locked: false });
            this.generateVariants();
        }
    }

    onChangeGroupName(index: number, value: string): void {
        const globalOptions = this.globalOptionGroups.find(
            optionGroup => optionGroup.name === value || optionGroup.code === value,
        )?.options;

        if (globalOptions) {
            this.optionGroups[index].isGlobal = true;
            this.optionGroups[index].globalOptions = globalOptions;
        } else {
            this.optionGroups[index].isGlobal = false;
            this.optionGroups[index].globalOptions = undefined;
        }
    }

    removeOption(index: number, optionName: string) {
        const group = this.optionGroups[index];
        if (group) {
            group.values = group.values.filter(v => v.name !== optionName);
            this.generateVariants();
        }
    }

    addOptionGroup() {
        this.optionGroups.push({ name: '', values: [] });
        const index = this.optionGroups.length - 1;
        setTimeout(() => {
            const input = this.groupNameInputs.get(index)?.nativeElement;
            input?.focus();
        });
    }

    removeOptionGroup(name: string) {
        this.optionGroups = this.optionGroups.filter(g => g.name !== name);
        this.generateVariants();
    }

    generateVariants() {
        const totalValuesCount = this.optionGroups.reduce((sum, group) => sum + group.values.length, 0);
        const groups = totalValuesCount
            ? this.optionGroups.map(g => g.values.map(v => v.name))
            : [[DEFAULT_VARIANT_CODE]];
        this.variants = generateAllCombinations(groups).map(values => ({ id: values.join('|'), values }));

        this.variants.forEach(variant => {
            if (!this.variantFormValues[variant.id]) {
                this.variantFormValues[variant.id] = {
                    optionValues: variant.values,
                    enabled: true,
                    price: this.copyFromDefault(variant.id, 'price', 0),
                    sku: this.copyFromDefault(variant.id, 'sku', ''),
                    stock: this.copyFromDefault(variant.id, 'stock', 0),
                };
            }
        });
        this.onFormChange();
    }

    trackByFn(index: number, variant: { name: string; values: string[] }) {
        return variant.values.join('|');
    }

    handleEnter(event: KeyboardEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.optionValueInputComponent?.focus();
    }

    onFormChange() {
        const variantsToCreate = this.variants.map(v => this.variantFormValues[v.id]).filter(v => v.enabled);
        this.variantsChange.emit({
            groups: this.optionGroups.map(og => ({
                name: og.name,
                values: og.values.map(v => ({ name: v.name, code: v.code })),
            })),
            variants: variantsToCreate,
        });
    }

    private copyFromDefault<T extends keyof CreateVariantValues>(
        variantId: string,
        prop: T,
        value: CreateVariantValues[T],
    ): CreateVariantValues[T] {
        return variantId !== DEFAULT_VARIANT_CODE
            ? this.variantFormValues[DEFAULT_VARIANT_CODE][prop]
            : value;
    }
}
