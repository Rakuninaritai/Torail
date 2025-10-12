from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import (
    Team, TeamMembership, Subject, Task, Record,
    LanguageMaster, UserProfile, UserSNS, PortfolioItem,
    JobRole, TechArea, ProductDomain,
    Company, CompanyMember, CompanyPlan, CompanyHiring,
    MessageTemplate, DMThread, DMMessage
)

User = get_user_model()

# ---- 共通: 検索/表示 mixin ----
class NameSearchAdmin(admin.ModelAdmin):
    search_fields = ('name',)
    list_per_page = 50

# ---- Team ----
class TeamMembershipInline(admin.TabularInline):
    model = TeamMembership
    extra = 1
    autocomplete_fields = ('user',)

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'owner', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'owner__username', 'owner__email')
    inlines = [TeamMembershipInline]
    autocomplete_fields = ('owner',)

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'user', 'team')
    list_filter = ('team',)
    search_fields = ('name', 'user__username', 'user__email')
    autocomplete_fields = ('user','team')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'user', 'team')
    list_filter = ('team',)
    search_fields = ('name', 'user__username', 'user__email')
    autocomplete_fields = ('user','team')

@admin.register(Record)
class RecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'subject', 'task', 'team', 'date', 'timer_state')
    list_filter = ('timer_state','team','date')
    search_fields = ('user__username','subject__name','task__name')
    autocomplete_fields = ('user','subject','task','team','languages')
    filter_horizontal = ('languages',)

# ---- Master ----
@admin.register(LanguageMaster)
class LanguageMasterAdmin(NameSearchAdmin):
    list_display = ('name','slug','category','popularity','is_active','created_at')
    list_filter = ('category','is_active')

@admin.register(JobRole)
class JobRoleAdmin(NameSearchAdmin):
    pass

@admin.register(TechArea)
class TechAreaAdmin(NameSearchAdmin):
    pass

@admin.register(ProductDomain)
class ProductDomainAdmin(NameSearchAdmin):
    pass



@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user','display_name','school','prefecture','is_public')
    search_fields = ('user__username','user__email','display_name','school')
    list_filter = ('is_public','prefecture')
    autocomplete_fields = ('user','desired_jobs','languages','product_domains','tech_areas')
    filter_horizontal = ('desired_jobs','languages','product_domains','tech_areas')
    # inlines = [UserSNSInline, PortfolioItemInline]  # ← これを削除

# ✅ User にインラインでぶら下げ直す
class UserSNSInline(admin.TabularInline):
    model = UserSNS
    extra = 1

class PortfolioItemInline(admin.TabularInline):
    model = PortfolioItem
    extra = 1

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id','username','email','account_type','is_staff','is_superuser')
    list_filter = ('account_type','is_staff','is_superuser','is_active')
    search_fields = ('username','email')
    inlines = [UserSNSInline, PortfolioItemInline]  # ← ここに付ける
# ---- Company ----
class CompanyMemberInline(admin.TabularInline):
    model = CompanyMember
    extra = 1
    autocomplete_fields = ('user',)

class CompanyPlanInline(admin.TabularInline):
    model = CompanyPlan
    extra = 0

class CompanyHiringInline(admin.TabularInline):
    model = CompanyHiring
    extra = 0

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name','owner','industry','website','created_at')
    search_fields = ('name','industry','owner__username','owner__email')
    list_filter = ('industry',)
    autocomplete_fields = ('owner',)
    inlines = [CompanyMemberInline, CompanyPlanInline, CompanyHiringInline]

@admin.register(CompanyMember)
class CompanyMemberAdmin(admin.ModelAdmin):
    list_display = ('company','user','role','joined_at')
    list_filter = ('role',)
    search_fields = ('company__name','user__username','user__email')
    autocomplete_fields = ('company','user')

@admin.register(CompanyPlan)
class CompanyPlanAdmin(admin.ModelAdmin):
    list_display = ('company','plan_type','monthly_quota','price_jpy','active_from','active_to')
    list_filter = ('plan_type',)
    search_fields = ('company__name',)
    autocomplete_fields = ('company',)

@admin.register(CompanyHiring)
class CompanyHiringAdmin(admin.ModelAdmin):
    list_display = ('company','title','employment_type','location','created_at')
    list_filter = ('employment_type','location')
    search_fields = ('company__name','title')
    autocomplete_fields = ('company',)

# ---- Templates / DM ----
@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ('name','owner_user','owner_company','created_at')
    search_fields = ('name','owner_user__username','owner_company__name')
    autocomplete_fields = ('owner_user','owner_company')

class DMMessageInline(admin.TabularInline):
    model = DMMessage
    extra = 0

@admin.register(DMThread)
class DMThreadAdmin(admin.ModelAdmin):
    list_display = ('company','user','created_at')
    search_fields = ('company__name','user__username','user__email')
    autocomplete_fields = ('company','user')
    inlines = [DMMessageInline]

@admin.register(DMMessage)
class DMMessageAdmin(admin.ModelAdmin):
    list_display = ('thread','sender','subject','created_at','is_read_by_company','is_read_by_user')
    list_filter = ('sender','is_read_by_company','is_read_by_user')
    search_fields = ('subject','body','thread__company__name','thread__user__username')
    autocomplete_fields = ('thread',)

